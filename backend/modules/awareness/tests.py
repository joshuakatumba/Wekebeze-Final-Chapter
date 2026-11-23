from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from modules.ai_assistant.models import Conversation, KnowledgeDocument
from modules.quizzes.models import Quiz

User = get_user_model()


class WekebezePlatformTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_wekebeze", verbosity=0)
        cls.user = User.objects.get(email="amina@wekebeze.org")
        cls.other = User.objects.create_user(email="other@wekebeze.org", name="Grace", password="Password123!", role="user")
        cls.admin = User.objects.get(email="admin@wekebeze.org")

    def setUp(self):
        self.client = APIClient()

    def test_guided_chat_flow_uses_logical_node_ids(self):
        res = self.client.get("/api/v1/awareness/guided-nodes/flow/?cancer_type=breast&language=en")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["start_node_id"], "awareness_question")
        self.assertIn("awareness_question", res.data["nodes"])
        self.assertIn("signs", res.data["nodes"])

    def test_quiz_hides_correct_answer_and_grades_server_side(self):
        quiz = Quiz.objects.filter(cancer_type="breast", language="en").first()
        self.assertIsNotNone(quiz)

        res = self.client.get(f"/api/v1/quizzes/{quiz.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertNotIn("correct_answer", res.data["questions"][0])

        self.client.force_authenticate(user=self.user)
        answers = {str(q.id): q.correct_answer for q in quiz.questions.all()}
        submit_res = self.client.post(f"/api/v1/quizzes/{quiz.id}/submit/", {"answers": answers}, format="json")
        self.assertEqual(submit_res.status_code, 201)
        self.assertEqual(submit_res.data["attempt"]["score"], quiz.questions.count())
        self.assertEqual(submit_res.data["attempt"]["percentage"], 100)

    def test_screening_nearby_search_and_districts(self):
        d_res = self.client.get("/api/v1/screening/centers/districts/")
        self.assertEqual(d_res.status_code, 200)
        self.assertIn("Kampala", d_res.data)

        n_res = self.client.get("/api/v1/screening/centers/nearby/?lat=0.3476&lng=32.5825&radius_km=20")
        self.assertEqual(n_res.status_code, 200)
        self.assertGreaterEqual(len(n_res.data), 1)
        self.assertIn("distance_km", n_res.data[0])

    def test_ai_conversation_isolation_rag_and_urgent_triage(self):
        # Draft document must NOT be retrieved
        KnowledgeDocument.objects.create(
            title="Unapproved Secret Draft",
            content="Secret unverified zebra protocol for testing.",
            language="en",
            review_status=KnowledgeDocument.ReviewStatus.DRAFT,
        )

        self.client.force_authenticate(user=self.user)
        conv_res = self.client.post("/api/v1/ai/conversations/", {"language": "en"}, format="json")
        self.assertEqual(conv_res.status_code, 201)
        conv_id = conv_res.data["id"]

        # Normal awareness question retrieves approved RAG sources
        msg_res = self.client.post(
            f"/api/v1/ai/conversations/{conv_id}/messages/",
            {"content": "What are the symptoms of breast cancer?", "language": "en"},
            format="json",
        )
        self.assertEqual(msg_res.status_code, 201)
        self.assertGreaterEqual(len(msg_res.data["assistant_message"]["sources"]), 1)
        self.assertNotIn("Secret unverified zebra", msg_res.data["assistant_message"]["content"])

        # Urgent symptom triggers immediate medical escalation
        urg_res = self.client.post(
            f"/api/v1/ai/conversations/{conv_id}/messages/",
            {"content": "I am having heavy bleeding and fainting", "language": "en"},
            format="json",
        )
        self.assertEqual(urg_res.status_code, 201)
        self.assertTrue(urg_res.data["assistant_message"]["metadata"]["is_urgent"])

        # Another user AND even an admin cannot read user's private conversation
        self.client.force_authenticate(user=self.other)
        self.assertEqual(self.client.get(f"/api/v1/ai/conversations/{conv_id}/").status_code, 404)
        self.client.force_authenticate(user=self.admin)
        self.assertEqual(self.client.get(f"/api/v1/ai/conversations/{conv_id}/").status_code, 404)

    def test_admin_analytics_requires_admin_role(self):
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.client.get("/api/v1/awareness/analytics/").status_code, 403)

        self.client.force_authenticate(user=self.admin)
        res = self.client.get("/api/v1/awareness/analytics/")
        self.assertEqual(res.status_code, 200)
        self.assertGreaterEqual(res.data["screening"]["total_centers"], 1)
        self.assertGreaterEqual(res.data["ai_assistant"]["approved_documents"], 1)

    def test_concurrency_mutex_semaphore_and_dynamic_site_config(self):
        import threading
        import time
        from core.concurrency import bounded_semaphore, distributed_mutex

        # 1. Verify distributed_mutex enforces strict mutual exclusion
        counter = {"active": 0, "max_active": 0}
        def worker():
            with distributed_mutex("test:critical_section", ttl_seconds=5):
                counter["active"] += 1
                counter["max_active"] = max(counter["max_active"], counter["active"])
                time.sleep(0.02)
                counter["active"] -= 1

        threads = [threading.Thread(target=worker) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertEqual(counter["max_active"], 1)

        # 2. Verify bounded_semaphore caps concurrency at max_concurrent=2
        sem_state = {"active": 0, "max_active": 0}
        state_lock = threading.Lock()
        def sem_worker():
            with bounded_semaphore("test:pool", max_concurrent=2, ttl_seconds=5):
                with state_lock:
                    sem_state["active"] += 1
                    sem_state["max_active"] = max(sem_state["max_active"], sem_state["active"])
                time.sleep(0.02)
                with state_lock:
                    sem_state["active"] -= 1

        threads = [threading.Thread(target=sem_worker) for _ in range(6)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertLessEqual(sem_state["max_active"], 2)

        # 3. Verify public read & admin-only update of dynamic AppConfig
        pub_res = self.client.get("/api/v1/core/config/")
        self.assertEqual(pub_res.status_code, 200)
        self.assertIn("hero_title", pub_res.data["settings_json"])

        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.client.patch("/api/v1/core/config/", {"settings_json": {"show_quizzes": False}}, format="json").status_code, 403)

        self.client.force_authenticate(user=self.admin)
        upd = self.client.patch("/api/v1/core/config/", {"settings_json": {**pub_res.data["settings_json"], "show_quizzes": False}}, format="json")
        self.assertEqual(upd.status_code, 200)
        self.assertFalse(upd.data["settings_json"]["show_quizzes"])

    def test_educator_strict_rbac_and_rw_lock(self):
        import threading
        import time
        from core.concurrency import rw_lock

        educator = User.objects.get(email="educator@wekebeze.org")
        self.client.force_authenticate(user=educator)

        # Educator CAN access their own stats and AI knowledge base
        self.assertEqual(self.client.get("/api/v1/awareness/educator-stats/").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/ai/knowledge/").status_code, 200)

        # Educator CANNOT access Admin-only endpoints
        self.assertEqual(self.client.get("/api/v1/accounts/users/").status_code, 403)
        self.assertEqual(self.client.get("/api/v1/awareness/analytics/").status_code, 403)
        self.assertEqual(self.client.get("/api/v1/core/audit-logs/").status_code, 403)
        self.assertEqual(
            self.client.patch("/api/v1/core/config/", {"settings_json": {"hero_title": "Hack"}}, format="json").status_code,
            403,
        )
        self.assertEqual(
            self.client.post(
                "/api/v1/screening/centers/",
                {"name": "Unauthorized Center", "district": "Kampala", "location": "Test"},
                format="json",
            ).status_code,
            403,
        )

        # Verify rw_lock prevents reader/writer overlap
        state = {"readers": 0, "writers": 0, "overlap": False}
        guard = threading.Lock()

        def reader():
            with rw_lock("test:rw", mode="read"):
                with guard:
                    state["readers"] += 1
                    if state["writers"] > 0:
                        state["overlap"] = True
                time.sleep(0.015)
                with guard:
                    state["readers"] -= 1

        def writer():
            with rw_lock("test:rw", mode="write"):
                with guard:
                    state["writers"] += 1
                    if state["readers"] > 0 or state["writers"] > 1:
                        state["overlap"] = True
                time.sleep(0.015)
                with guard:
                    state["writers"] -= 1

        threads = [threading.Thread(target=reader) for _ in range(4)] + [threading.Thread(target=writer) for _ in range(2)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertFalse(state["overlap"])

    def test_multi_provider_llm_resolution(self):
        import os
        from unittest.mock import patch
        from modules.ai_assistant.llm import resolve_llm_config

        with patch.dict(os.environ, {"LLM_PROVIDER": "", "LLM_MODEL": "gemini-2.5-flash", "LLM_BASE_URL": ""}, clear=False):
            cfg = resolve_llm_config()
            self.assertEqual(cfg["provider"], "gemini")
            self.assertIn("generativelanguage.googleapis.com", cfg["base_url"])

        with patch.dict(os.environ, {"LLM_PROVIDER": "", "LLM_MODEL": "claude-3-5-haiku-latest", "LLM_BASE_URL": ""}, clear=False):
            cfg = resolve_llm_config()
            self.assertEqual(cfg["provider"], "anthropic")

        with patch.dict(os.environ, {"LLM_PROVIDER": "groq", "LLM_MODEL": "", "LLM_BASE_URL": ""}, clear=False):
            cfg = resolve_llm_config()
            self.assertEqual(cfg["provider"], "groq")
            self.assertIn("api.groq.com", cfg["base_url"])

        with patch.dict(os.environ, {"LLM_PROVIDER": "ollama", "LLM_MODEL": "llama3.2", "LLM_BASE_URL": ""}, clear=False):
            cfg = resolve_llm_config()
            self.assertEqual(cfg["provider"], "ollama")
            self.assertEqual(cfg["model"], "llama3.2")

    def test_vector_embeddings_and_self_improving_feedback(self):
        from modules.ai_assistant.models import KnowledgeChunk, LearningInsight

        # Re-ingest an approved doc to verify 256-dim dense vector storage
        chunk = KnowledgeChunk.objects.first()
        self.assertIsNotNone(chunk)
        self.assertEqual(len(chunk.embedding), 256)

        self.client.force_authenticate(user=self.user)
        conv = self.client.post("/api/v1/ai/conversations/", {"language": "en"}, format="json").data
        msg_res = self.client.post(
            f"/api/v1/ai/conversations/{conv['id']}/messages/",
            {"content": "What are the symptoms of breast cancer?", "language": "en"},
            format="json",
        )
        asst_id = msg_res.data["assistant_message"]["id"]

        # Positive user feedback increases chunk quality_score and creates a LearningInsight
        fb_res = self.client.post(
            f"/api/v1/ai/conversations/{conv['id']}/feedback/",
            {"message_id": asst_id, "rating": 1},
            format="json",
        )
        self.assertEqual(fb_res.status_code, 200)
        cited_chunk_id = msg_res.data["assistant_message"]["sources"][0]["chunk_id"]
        updated_chunk = KnowledgeChunk.objects.get(id=cited_chunk_id)
        self.assertEqual(updated_chunk.helpful_count, 1)
        self.assertGreater(updated_chunk.quality_score, 1.0)
        self.assertGreaterEqual(LearningInsight.objects.count(), 1)

