import json
from pathlib import Path
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import AppConfig
from modules.awareness.models import AwarenessArticle, AwarenessCategory, GuidedChatNode
from modules.quizzes.models import Quiz, QuizQuestion
from modules.screening.models import CenterService, ScreeningCenter
from modules.ai_assistant.models import KnowledgeDocument
from modules.ai_assistant.rag import ingest_document

User = get_user_model()


class Command(BaseCommand):
    help = "Seed Wekebeze actors, awareness content, guided chat nodes, quizzes, screening centers, and approved AI knowledge."

    def handle(self, *args, **options):
        self._seed_site_config()
        self._seed_demo_actors()
        self._seed_guided_nodes()
        self._seed_awareness_articles()
        self._seed_quizzes()
        self._seed_screening_centers()
        self._seed_knowledge_documents()
        self.stdout.write(self.style.SUCCESS("Wekebeze data seeded successfully."))

    def _seed_site_config(self):
        cfg = AppConfig.load()
        cfg.app_name = "Wekebeze"
        defaults = {
            "hero_title": "Wekebeze",
            "hero_accent": "Care",
            "hero_subtitle": "Breast and cervical cancer awareness, AI guidance, and verified screening centers in English and Luganda.",
            "hero_image": "/images/together.jpg",
            "show_awareness": True,
            "show_ai_chat": True,
            "show_guided_chat": True,
            "show_quizzes": True,
            "show_screening": True,
        }
        merged = {**defaults, **(cfg.settings_json or {})}
        cfg.settings_json = merged
        cfg.save()
        self.stdout.write("  Seeded dynamic site configuration (AppConfig).")

    def _seed_demo_actors(self):
        actors = [
            ("amina@wekebeze.org", "Amina Nakato", "User@2026!", "user", False, False),
            ("educator@wekebeze.org", "Dr. Sarah Namukasa", "Educator@2026!", "provider", False, False),
            ("admin@wekebeze.org", "Joshua Katumba", "Admin@2026!", "admin", True, True),
        ]
        for email, name, password, role, is_staff, is_super in actors:
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "name": name,
                    "role": role,
                    "is_verified": True,
                    "is_active": True,
                    "is_staff": is_staff,
                    "is_superuser": is_super,
                },
            )
            if not created:
                user.name = name
                user.role = role
                user.is_verified = True
                user.is_active = True
                user.is_staff = is_staff
                user.is_superuser = is_super
            user.set_password(password)
            user.save()
        self.stdout.write("  Seeded 3 demo actor accounts (user, provider/educator, admin).")

    def _seed_guided_nodes(self):
        data_dir = Path(__file__).resolve().parents[2] / "data"
        if not data_dir.exists():
            data_dir = Path(__file__).resolve().parents[6] / "wekebeze-app" / "frontend" / "src" / "features" / "awareness-hub" / "data"
        pairs = [
            ("breast", "en", "breast_en.json"),
            ("breast", "lg", "breast_lg.json"),
            ("cervical", "en", "cervical_en.json"),
            ("cervical", "lg", "cervical_lg.json"),
            ("prostate", "en", "prostate_en.json"),
            ("prostate", "lg", "prostate_lg.json"),
        ]
        count = 0
        for cancer_type, lang, fname in pairs:
            fpath = data_dir / fname
            if not fpath.exists():
                continue
            data = json.loads(fpath.read_text(encoding="utf-8"))
            for node in data.get("nodes", []):
                GuidedChatNode.objects.update_or_create(
                    cancer_type=cancer_type,
                    language=lang,
                    node_id=node["id"],
                    defaults={
                        "is_start": bool(node.get("start", False)),
                        "title": node.get("title", node["id"].replace("_", " ").title()),
                        "text": node.get("text", ""),
                        "image": node.get("image", ""),
                        "options": node.get("options", []),
                        "status": "published",
                    },
                )
                count += 1
        self.stdout.write(f"  Seeded {count} guided chat nodes.")

    def _seed_awareness_articles(self):
        categories_data = [
            ("breast-basics", "breast", "en", "Breast Cancer Essentials", "Signs, self-exams, risk factors, and early detection.", "/images/breast.jpg", 1),
            ("cervical-basics", "cervical", "en", "Cervical Cancer & HPV", "HPV prevention, vaccination, VIA/Pap screening, and symptoms.", "/images/cervical.jpg", 2),
            ("breast-basics", "breast", "lg", "Ebikwata ku Kookolo w'Amabeere", "Obubonero, okwekebera amabeere, n'okumanya ebireeta kookolo.", "/images/breast.jpg", 1),
            ("cervical-basics", "cervical", "lg", "Kookolo w'Omumwa gwa Nnabaana", "Okuziyiza HPV, okugemesa, n'okwekebeza mu budde.", "/images/cervical.jpg", 2),
        ]
        cats = {}
        for slug, ct, lang, name, desc, img, order in categories_data:
            cat, _ = AwarenessCategory.objects.update_or_create(
                slug=slug, language=lang,
                defaults={"cancer_type": ct, "name": name, "description": desc, "image_url": img, "order": order, "status": "published"},
            )
            cats[(slug, lang)] = cat

        articles = [
            (
                ("breast-basics", "en"), "breast", "en",
                "Recognizing Early Signs of Breast Cancer",
                "Learn the warning signs to watch for and how monthly breast self-checks support early detection.",
                "Common early warning signs of breast cancer include a new lump or thickening in the breast or underarm, changes in breast size or shape, skin dimpling (like an orange peel), nipple inversion or unusual discharge, and persistent redness.\n\nMost breast lumps are not cancerous, but any new change should be evaluated promptly by a healthcare professional. Performing a monthly breast self-examination helps you become familiar with what is normal for your body.",
                "/images/breast.jpg",
            ),
            (
                ("cervical-basics", "en"), "cervical", "en",
                "Preventing Cervical Cancer with HPV Vaccination & Screening",
                "Cervical cancer is one of the most preventable cancers when caught early through VIA or Pap screening.",
                "Nearly all cases of cervical cancer are caused by persistent infection with high-risk types of Human Papillomavirus (HPV). Prevention combines two proven strategies:\n\n1. HPV Vaccination: Recommended for girls aged 9–14 years (free under Uganda's national immunization program).\n2. Regular Screening: Visual Inspection with Acetic Acid (VIA), Pap smears, or HPV DNA testing detect precancerous changes early when treatment is simple and highly effective.",
                "/images/cervical.jpg",
            ),
            (
                ("breast-basics", "lg"), "breast", "lg",
                "Okutegeera Obubonero obw'Amangu obwa Kookolo w'Amabeere",
                "Yiga obubonero bw'olina okwetegereza n'engeri y'okwekebera amabeere buli mwezi.",
                "Obubonero obw'amangu obwa kookolo w'amabeere mulimu ekizimba oba okukaluba mu bbeere oba mu nkwawa, enkyukakyuka mu bunene oba enkula y'ebbeere, olususu okukonyolwa, oba amazzi agava mu nnywanto.\n\nEbizimba ebisinga tebiba kookolo, naye bwe olaba enkyukakyuka yonna, genda mangu olabe omusawo omutendeke.",
                "/images/breast.jpg",
            ),
            (
                ("cervical-basics", "lg"), "cervical", "lg",
                "Okuziyiza Kookolo w'Omumwa gwa Nnabaana n'Eddagala lya HPV",
                "Kookolo w'omumwa gwa nnabaana asobola okuziyizibwa singa okwekebeza n'okugemesa bikolebwa mu budde.",
                "Kookolo w'omumwa gwa nnabaana okusinga aleetebwa akawuka ka HPV. Osobola okumwewala nga:\n\n1. Ogema abawala abali wakati w'emyaka 9 ne 14 eddagala lya HPV (liwaabwa bweereere mu malwaliro ga gavumenti mu Uganda).\n2. Okwekebeza buli kiseera (VIA oba Pap smear) okuzuula enkyukakyuka nga bukyali.",
                "/images/cervical.jpg",
            ),
        ]
        for cat_key, ct, lang, title, summary, content, img in articles:
            AwarenessArticle.objects.update_or_create(
                title=title, language=lang,
                defaults={
                    "category": cats[cat_key],
                    "cancer_type": ct,
                    "summary": summary,
                    "content": content,
                    "image_url": img,
                    "status": "published",
                },
            )
        self.stdout.write("  Seeded awareness categories and articles.")

    def _seed_quizzes(self):
        quizzes = [
            (
                "Breast Cancer Awareness Check",
                "Test your knowledge on early signs, monthly self-checks, and risk factors.",
                "breast", "en",
                [
                    ("What is a common early sign of breast cancer?", ["A new lump or thickening in the breast", "Frequent headaches", "Sore throat", "Lower back pain"], 0, "A painless lump or thickening in the breast or underarm is the most common early sign."),
                    ("How often should you perform a breast self-awareness check?", ["Once every five years", "Monthly", "Only when feeling pain", "Never"], 1, "Monthly checks help you notice any unusual changes early."),
                    ("Which of the following is NOT an established risk factor for breast cancer?", ["Family history", "Increasing age", "Eating sugar", "BRCA genetic mutations"], 2, "Sugar intake is not a direct cause of breast cancer, whereas age, family history, and BRCA mutations are established risk factors."),
                ],
            ),
            (
                "Cervical Cancer & HPV Check",
                "Check what you know about HPV prevention, vaccination, and screening.",
                "cervical", "en",
                [
                    ("What is the primary cause of cervical cancer?", ["Poor hygiene", "Persistent high-risk HPV infection", "Everyday stress", "Inherited blood type"], 1, "Persistent infection with high-risk Human Papillomavirus (HPV) causes nearly all cervical cancer cases."),
                    ("Which proven method helps prevent cervical cancer?", ["HPV vaccination and regular screening", "Drinking herbal tea", "Avoiding cold water", "Skipping check-ups"], 0, "HPV vaccination for young girls and regular VIA/Pap screening save lives."),
                ],
            ),
            (
                "Okugezesa Okumanya ku Kookolo w'Amabeere",
                "Gezesa by'omanyi ku bubonero n'okwekebeza kookolo w'amabeere.",
                "breast", "lg",
                [
                    ("Kaki akabonero akasooka aka kookolo w'amabeere?", ["Ekizimba mu bbeere oba mu nkwawa", "Omutwe okukuba", "Obulumi mu mugongo", "Ekifuba"], 0, "Ekizimba oba okukaluba mu bbeere kye kimu ku bubonero obusooka."),
                    ("Okwekebera amabeere kulina kukolebwa emirundi emeka?", ["Omulundi gumu buli mwezi", "Omulundi gumu buli myaka etaano", "Lwe wabaawo obulumi bwokka", "Tewali bwetaavu"], 0, "Okwekebera buli mwezi kuyamba okuzuula enkyukakyuka amangu."),
                ],
            ),
        ]
        for title, desc, ct, lang, questions in quizzes:
            quiz, _ = Quiz.objects.update_or_create(
                title=title, language=lang,
                defaults={"description": desc, "cancer_type": ct, "status": "published"},
            )
            if quiz.questions.count() == 0:
                for idx, (q_text, opts, ans, exp) in enumerate(questions):
                    QuizQuestion.objects.create(
                        quiz=quiz, question=q_text, options=opts,
                        correct_answer=ans, explanation=exp, order=idx,
                    )
        self.stdout.write("  Seeded quizzes and questions.")

    def _seed_screening_centers(self):
        centers = [
            (
                "Uganda Cancer Institute (Mulago)", "Kampala", "Upper Mulago Hill Road, Kampala",
                "National referral center for comprehensive cancer screening, diagnosis, and care.",
                0.3396, 32.5766, "+256 414 540 410", "Mon–Fri, 8:00 AM – 5:00 PM",
                [("Clinical Breast Exam", 0), ("Cervical VIA Screening", 0), ("Pap Smear", 20000)],
            ),
            (
                "Mengo Hospital Cancer Clinic", "Kampala", "Namirembe Hill, Kampala",
                "Trusted community hospital offering breast and cervical cancer screening.",
                0.3125, 32.5582, "+256 414 270 222", "Mon–Sat, 8:00 AM – 4:30 PM",
                [("Clinical Breast Exam", 15000), ("Breast Ultrasound", 50000), ("Pap Smear", 45000)],
            ),
            (
                "Kawempe National Referral Hospital", "Kampala", "Kawempe, Bombo Road, Kampala",
                "Public women's health referral hospital offering free cervical and breast screening.",
                0.3712, 32.5579, "+256 414 567 210", "Mon–Fri, 8:00 AM – 4:00 PM",
                [("Cervical VIA Screening", 0), ("Clinical Breast Exam", 0)],
            ),
            (
                "Mbarara Regional Referral Hospital", "Mbarara", "Mbarara City Center, Western Uganda",
                "Regional referral facility providing free cervical screening and breast checks.",
                -0.6164, 30.6582, "+256 485 420 007", "Mon–Fri, 8:00 AM – 5:00 PM",
                [("Cervical VIA Screening", 0), ("Clinical Breast Exam", 0), ("Breast Ultrasound", 30000)],
            ),
            (
                "Gulu Regional Referral Hospital", "Gulu", "Gulu City, Northern Uganda",
                "Public referral hospital offering community cancer awareness and screening services.",
                2.7724, 32.2881, "+256 471 432 061", "Mon–Fri, 8:00 AM – 5:00 PM",
                [("Cervical VIA Screening", 0), ("Clinical Breast Exam", 0)],
            ),
            (
                "Jinja Regional Referral Hospital", "Jinja", "Rotary Road, Jinja City, Eastern Uganda",
                "Eastern region referral center with dedicated women's preventive screening clinic.",
                0.4281, 33.2041, "+256 434 122 000", "Mon–Fri, 8:00 AM – 4:30 PM",
                [("Cervical VIA Screening", 0), ("Clinical Breast Exam", 0)],
            ),
        ]
        for name, district, loc, desc, lat, lng, contact, hours, services in centers:
            center, created = ScreeningCenter.objects.update_or_create(
                name=name,
                defaults={
                    "district": district, "location": loc, "description": desc,
                    "latitude": lat, "longitude": lng, "contact": contact,
                    "operating_hours": hours, "is_verified": True,
                    "verified_at": timezone.now(), "status": "active",
                },
            )
            if created or center.services.count() == 0:
                center.services.all().delete()
                for s_name, s_price in services:
                    CenterService.objects.create(center=center, name=s_name, price=s_price, currency="UGX")
        self.stdout.write("  Seeded Ugandan screening centers.")

    def _seed_knowledge_documents(self):
        docs = [
            (
                "Breast Cancer Symptoms, Self-Exam & Screening Guide",
                "Uganda Cancer Institute & WHO Guidelines",
                "guideline", "en",
                "Breast cancer starts when cells in the breast grow out of control. Early detection greatly improves survival.\n\n"
                "Common signs and symptoms include: a new lump or thickening in the breast or armpit, changes in breast size or shape, dimpling or puckering of the skin, nipple retraction, redness or flakiness around the nipple, or unusual nipple discharge.\n\n"
                "How to screen: Perform a monthly breast self-check to notice changes early, schedule a Clinical Breast Exam (CBE) with a nurse or doctor, and discuss mammography or breast ultrasound with your healthcare provider (especially for women aged 40 and older or those with family history).",
            ),
            (
                "Cervical Cancer Prevention, HPV Vaccination & Screening in Uganda",
                "Ministry of Health Uganda / WHO",
                "guideline", "en",
                "Cervical cancer develops in the cervix and is primarily caused by persistent infection with high-risk Human Papillomavirus (HPV).\n\n"
                "Prevention: Uganda provides free HPV vaccination for girls aged 9 to 14 years through schools and health centers. Safe sexual practices and avoiding tobacco also lower risk.\n\n"
                "Screening: Women aged 25 to 49 (and earlier for women living with HIV) should get regular cervical screening using Visual Inspection with Acetic Acid (VIA), Pap smears, or HPV DNA tests. Early precancerous changes can be treated simply and effectively at public hospitals such as Mulago UCI, Kawempe, Mbarara, Gulu, and Jinja Regional Referral Hospitals.",
            ),
            (
                "Obubonero n'Okwekebeza Kookolo w'Amabeere n'Omumwa gwa Nnabaana",
                "Wekebeze & Uganda Cancer Institute (Luganda Summary)",
                "guideline", "lg",
                "Kookolo w'amabeere asobola okuzuulibwa nga bukyali singa weekebera buli mwezi. Obubonero mulimu ekizimba mu bbeere oba mu nkwawa, enkyukakyuka mu nkula y'ebbeere, oba amazzi agava mu nnywanto.\n\n"
                "Kookolo w'omumwa gwa nnabaana aleetebwa akawuka ka HPV. Okugemesa abawala ab'emyaka 9–14 eddagala lya HPV bweereere n'okwekebeza (VIA oba Pap smear) mu malwaliro nga Mulago UCI ne Kawempe kuyamba okuziyiza kookolo ono.",
            ),
        ]
        for title, source, doc_type, lang, content in docs:
            doc, _ = KnowledgeDocument.objects.update_or_create(
                title=title, language=lang,
                defaults={
                    "source": source,
                    "document_type": doc_type,
                    "content": content,
                    "review_status": KnowledgeDocument.ReviewStatus.APPROVED,
                    "published_at": timezone.now(),
                },
            )
            if doc.chunks.count() == 0:
                ingest_document(doc)
        self.stdout.write("  Seeded and indexed approved AI knowledge documents.")

