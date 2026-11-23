"""LangGraph-powered conversation workflow with LangChain LLM integration and grounded fallback."""
import os
from typing import Any, TypedDict

from .rag import retrieve_approved_chunks
from .safety import detect_urgent_symptoms, ensure_safety_footer, urgent_escalation_message

try:
    from langgraph.graph import END, StateGraph
    HAS_LANGGRAPH = True
except ImportError:
    HAS_LANGGRAPH = False


class ChatState(TypedDict, total=False):
    user_message: str
    language: str
    history: list[dict[str, str]]
    is_urgent: bool
    retrieved_chunks: list[dict[str, Any]]
    response: str
    sources: list[dict[str, Any]]


LUGANDA_HINTS = {"kookolo", "amabeere", "nnabaana", "okwekebeza", "obubonero", "omusawo", "eddagala", "bweereere", "bambi", "ntya"}


def detect_language_node(state: ChatState) -> ChatState:
    lang = state.get("language") or "en"
    words = set((state.get("user_message") or "").lower().split())
    if words & LUGANDA_HINTS:
        lang = "lg"
    return {**state, "language": lang}


def safety_triage_node(state: ChatState) -> ChatState:
    urgent = detect_urgent_symptoms(state.get("user_message", ""))
    if urgent:
        return {
            **state,
            "is_urgent": True,
            "response": urgent_escalation_message(state.get("language", "en")),
            "sources": [],
        }
    return {**state, "is_urgent": False}


def retrieve_knowledge_node(state: ChatState) -> ChatState:
    chunks = retrieve_approved_chunks(
        state.get("user_message", ""),
        language=state.get("language", "en"),
        top_k=4,
    )
    sources = [
        {
            "document_id": c["document_id"],
            "chunk_id": c["chunk_id"],
            "title": c["title"],
            "source": c["source"],
        }
        for c in chunks
    ]
    return {**state, "retrieved_chunks": chunks, "sources": sources}


def _call_configured_llm(user_message: str, language: str, history: list[dict], chunks: list[dict]) -> str | None:
    """Use LangChain LLM when LLM_API_KEY is configured in environment."""
    api_key = os.environ.get("LLM_API_KEY", "").strip()
    if not api_key:
        return None
    model_name = os.environ.get("LLM_MODEL", "gpt-4o-mini").strip()
    context_text = "\n\n".join(
        f"[{c['title']} — {c['source']}]\n{c['content']}" for c in chunks
    ) or "No specific approved knowledge base passage matched."

    lang_instruction = "Respond clearly and empathetically in Luganda." if language == "lg" else "Respond clearly, empathetically, and concisely in English."
    system_prompt = (
        "You are Wekebeze, a trusted cancer-awareness educational assistant for communities in Uganda. "
        "Answer questions about breast cancer, cervical cancer, prevention, HPV vaccination, symptoms, and screening. "
        "Ground your response in the verified context below. Never diagnose cancer or prescribe treatment. "
        "If reliable information is unavailable in the context, state that honestly and recommend consulting a healthcare professional. "
        f"{lang_instruction}\n\nVerified Context:\n{context_text}"
    )

    try:
        from langchain_openai import ChatOpenAI
        from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

        llm = ChatOpenAI(api_key=api_key, model=model_name, temperature=0.2, timeout=30)
        msgs = [SystemMessage(content=system_prompt)]
        for h in (history or [])[-6:]:
            if h.get("role") == "user":
                msgs.append(HumanMessage(content=h["content"]))
            elif h.get("role") == "assistant":
                msgs.append(AIMessage(content=h["content"]))
        msgs.append(HumanMessage(content=user_message))
        result = llm.invoke(msgs)
        return getattr(result, "content", str(result))
    except Exception:
        return None


def generate_response_node(state: ChatState) -> ChatState:
    lang = state.get("language", "en")
    chunks = state.get("retrieved_chunks") or []
    llm_answer = _call_configured_llm(
        state.get("user_message", ""),
        lang,
        state.get("history", []),
        chunks,
    )
    if llm_answer:
        return {**state, "response": llm_answer}

    # Grounded knowledge-base response when no external LLM key is configured
    if chunks:
        intro = (
            "Okusinziira ku bubaka obukakasiddwa okuva mu Wekebeze:\n\n"
            if lang == "lg"
            else "Based on Wekebeze's verified cancer-awareness knowledge base:\n\n"
        )
        body = "\n\n".join(f"**{c['title']}**\n{c['content']}" for c in chunks[:2])
        return {**state, "response": intro + body}

    fallback = (
        "Nsonyiwa, sirina bubaka bukakasiddwa bukwata butereevu ku kibuuzo ekyo mu kiseera kino. "
        "Oyinza okumbuuza ku bubonero, okwekebeza, eddagala lya HPV, oba ebifo by'okwekebeza kookolo w'amabeere "
        "n'omumwa gwa nnabaana mu Uganda, oba okukyalira omusawo omutendeke."
        if lang == "lg"
        else "I don't have verified information directly matching that question in the approved knowledge base yet. "
        "You can ask me about breast cancer or cervical cancer symptoms, risk factors, self-exams, HPV vaccination, "
        "or screening centers in Uganda — or consult a qualified healthcare professional."
    )
    return {**state, "response": fallback}


def validate_safety_node(state: ChatState) -> ChatState:
    safe_text = ensure_safety_footer(state.get("response", ""), state.get("language", "en"))
    return {**state, "response": safe_text}


def _route_after_triage(state: ChatState) -> str:
    return "end" if state.get("is_urgent") else "retrieve"


def _build_graph():
    if not HAS_LANGGRAPH:
        return None
    builder = StateGraph(ChatState)
    builder.add_node("detect_language", detect_language_node)
    builder.add_node("safety_triage", safety_triage_node)
    builder.add_node("retrieve_knowledge", retrieve_knowledge_node)
    builder.add_node("generate_response", generate_response_node)
    builder.add_node("validate_safety", validate_safety_node)

    builder.set_entry_point("detect_language")
    builder.add_edge("detect_language", "safety_triage")
    builder.add_conditional_edges(
        "safety_triage",
        _route_after_triage,
        {"end": END, "retrieve": "retrieve_knowledge"},
    )
    builder.add_edge("retrieve_knowledge", "generate_response")
    builder.add_edge("generate_response", "validate_safety")
    builder.add_edge("validate_safety", END)
    return builder.compile()


_COMPILED_GRAPH = _build_graph()


def run_chat_graph(user_message: str, language: str = "en", history: list[dict] | None = None) -> ChatState:
    initial: ChatState = {
        "user_message": user_message,
        "language": language,
        "history": history or [],
    }
    if _COMPILED_GRAPH is not None:
        return _COMPILED_GRAPH.invoke(initial)

    state = detect_language_node(initial)
    state = safety_triage_node(state)
    if state.get("is_urgent"):
        return state
    state = retrieve_knowledge_node(state)
    state = generate_response_node(state)
    state = validate_safety_node(state)
    return state

