import os, io, csv, hashlib, hmac, secrets, json, datetime as dt
from collections import Counter, defaultdict
from typing import Optional
import jwt
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from .ml_service import analyze_text
from .sample_data import SAMPLES

DB_URL = os.getenv("DATABASE_URL", "sqlite:///./sif.db")  # PostgreSQL: postgresql+psycopg2://user:pw@localhost/sif
SECRET = os.getenv("JWT_SECRET", "change-me")
DISCLAIMER = "AI-assisted analysis. Final assessment and safety decisions remain with authorized HSE personnel."
engine = create_engine(DB_URL)
Session_ = sessionmaker(bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True); name = Column(String); email = Column(String, unique=True)
    password_hash = Column(String); role = Column(String); department = Column(String)


class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True); code = Column(String, unique=True)
    reporter_id = Column(Integer, ForeignKey("users.id")); report_type = Column(String)
    date = Column(String); site = Column(String); location = Column(String); activity = Column(String)
    description = Column(Text); immediate_action = Column(Text); equipment = Column(String)
    barrier_failure = Column(Text); created_at = Column(DateTime, default=dt.datetime.utcnow)


class Analysis(Base):
    __tablename__ = "ai_analysis"
    id = Column(Integer, primary_key=True); report_id = Column(Integer, ForeignKey("reports.id"), unique=True)
    sif_prediction = Column(Boolean); confidence = Column(Float); priority = Column(String)
    life_saving_rule = Column(String); hazard = Column(String); unsafe_action = Column(Text)
    unsafe_condition = Column(Text); barrier_failure = Column(Text); potential_consequence = Column(String)
    extracted_keywords = Column(Text); evidence = Column(Text); analyzed_at = Column(DateTime, default=dt.datetime.utcnow)


class Review(Base):
    __tablename__ = "hse_reviews"
    id = Column(Integer, primary_key=True); report_id = Column(Integer, ForeignKey("reports.id"), unique=True)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String, default="Pending Review"); comments = Column(Text); action_required = Column(Text)
    action_owner = Column(String); review_date = Column(DateTime)


STATUSES = ["Pending Review", "Under Review", "Reviewed", "Further Investigation Required", "Action Initiated", "Closed"]


def hash_pw(pw, salt=None):
    salt = salt or secrets.token_hex(16)
    return salt + "$" + hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 200_000).hex()


def check_pw(pw, stored):
    return hmac.compare_digest(hash_pw(pw, stored.split("$")[0]), stored)


def get_db():
    db = Session_()
    try: yield db
    finally: db.close()


bearer = HTTPBearer()


def current_user(cred=Depends(bearer), db: Session = Depends(get_db)) -> User:
    try: uid = jwt.decode(cred.credentials, SECRET, algorithms=["HS256"])["uid"]
    except Exception: raise HTTPException(401, "Invalid or expired token")
    u = db.get(User, uid)
    if not u: raise HTTPException(401, "User not found")
    return u


def admin_only(u: User = Depends(current_user)) -> User:
    if u.role != "hse_admin": raise HTTPException(403, "HSE Admin access required")
    return u


def store_analysis(db, r: Report):
    a = analyze_text(r.description, r.activity or "")
    if not r.activity: r.activity = ""
    row = db.query(Analysis).filter_by(report_id=r.id).first() or Analysis(report_id=r.id)
    row.sif_prediction, row.confidence, row.priority = a["sif"], a["confidence"], a["priority"]
    row.life_saving_rule, row.hazard, row.unsafe_action = a["life_saving_rule"], a["hazard"], a["unsafe_action"]
    row.unsafe_condition, row.barrier_failure = a["unsafe_condition"], a["barrier_failure"]
    row.potential_consequence = a["potential_consequence"]
    row.extracted_keywords, row.evidence = json.dumps(a["keywords"]), json.dumps(a["evidence"])
    row.analyzed_at = dt.datetime.utcnow()
    db.add(row)
    if not db.query(Review).filter_by(report_id=r.id).first():
        db.add(Review(report_id=r.id))  # AI never closes a report; every report starts pending
    return row


def make_report(db, uid, **f) -> Report:
    r = Report(reporter_id=uid, **f); db.add(r); db.flush()
    r.code = f"OIL-{dt.date.today().year}-{r.id:04d}"
    store_analysis(db, r)
    return r


def out(db, r: Report):
    a = db.query(Analysis).filter_by(report_id=r.id).first(); v = db.query(Review).filter_by(report_id=r.id).first()
    rep = db.get(User, r.reporter_id)
    return {
        "id": r.id, "report_id": r.code, "reporter": rep.name if rep else None, "type": r.report_type, "date": r.date,
        "site": r.site, "location": r.location, "activity": r.activity, "description": r.description,
        "immediate_action": r.immediate_action, "equipment": r.equipment,
        "analysis": a and {
            "sif_potential": "YES" if a.sif_prediction else "NO", "confidence": round(a.confidence * 100),
            "priority": a.priority, "life_saving_rule": a.life_saving_rule, "hazard": a.hazard,
            "unsafe_action": a.unsafe_action, "unsafe_condition": a.unsafe_condition,
            "barrier_failure": a.barrier_failure, "potential_consequence": a.potential_consequence,
            "keywords": json.loads(a.extracted_keywords or "[]"), "evidence": json.loads(a.evidence or "[]"),
            "disclaimer": DISCLAIMER},
        "review": v and {"status": v.status, "comments": v.comments, "action_required": v.action_required,
                         "action_owner": v.action_owner, "review_date": v.review_date}}


app = FastAPI(title="OIL SIF Precursor Detection API")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def startup():
    Base.metadata.create_all(engine)
    db = Session_()
    if not db.query(User).count():
        m = User(name="Demo Manager", email="manager@oilindia.com", password_hash=hash_pw("Manager@123"), role="manager", department="Operations")
        h = User(name="HSE Admin", email="hseadmin@oilindia.com", password_hash=hash_pw("Admin@123"), role="hse_admin", department="HSE")
        db.add_all([m, h]); db.flush()
        for i, (t, s, l, a, d, txt) in enumerate(SAMPLES):
            r = make_report(db, m.id, report_type=t, site=s, location=l, activity=a, date=d, description=txt)
            if i % 3 == 0:
                v = db.query(Review).filter_by(report_id=r.id).first(); v.status, v.reviewer_id = "Reviewed", h.id
        db.commit()
    db.close()


class Login(BaseModel): email: str; password: str
class ReportIn(BaseModel):
    report_type: str; date: str; site: str; location: str; activity: str = ""; description: str
    immediate_action: str = ""; equipment: str = ""; barrier_failure: str = ""
class ReviewIn(BaseModel):
    status: str; comments: str = ""; action_required: str = ""; action_owner: str = ""


@app.post("/api/auth/login")
def login(b: Login, db: Session = Depends(get_db)):
    u = db.query(User).filter_by(email=b.email.strip().lower()).first()
    if not u or not check_pw(b.password, u.password_hash): raise HTTPException(401, "Wrong email or password")
    tok = jwt.encode({"uid": u.id, "exp": dt.datetime.utcnow() + dt.timedelta(hours=8)}, SECRET, algorithm="HS256")
    return {"token": tok, "user": {"id": u.id, "name": u.name, "role": u.role}}


@app.post("/api/reports")
def create_report(b: ReportIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    r = make_report(db, u.id, **b.dict()); db.commit()
    return out(db, r)


@app.get("/api/reports")
def list_reports(q: str = "", sif: Optional[str] = None, priority: Optional[str] = None, rule: Optional[str] = None,
                 site: Optional[str] = None, type: Optional[str] = None, status: Optional[str] = None,
                 u: User = Depends(current_user), db: Session = Depends(get_db)):
    qs = db.query(Report)
    if u.role != "hse_admin": qs = qs.filter(Report.reporter_id == u.id)  # managers see only their own
    if site: qs = qs.filter(Report.site == site)
    if type: qs = qs.filter(Report.report_type == type)
    res = [out(db, r) for r in qs.order_by(Report.id.desc())]
    ql = q.lower()
    def ok(x):
        a, v = x["analysis"] or {}, x["review"] or {}
        return ((not ql or ql in " ".join(str(x[k] or "") for k in ("report_id", "location", "activity", "description", "reporter")).lower())
                and (not sif or a.get("sif_potential") == sif) and (not priority or a.get("priority") == priority)
                and (not rule or a.get("life_saving_rule") == rule) and (not status or v.get("status") == status))
    return [x for x in res if ok(x)]


@app.get("/api/reports/{rid}")
def get_report(rid: int, u: User = Depends(current_user), db: Session = Depends(get_db)):
    r = db.get(Report, rid)
    if not r or (u.role != "hse_admin" and r.reporter_id != u.id): raise HTTPException(404, "Report not found")
    return out(db, r)


@app.post("/api/ai/analyze/{rid}")
def reanalyze(rid: int, u: User = Depends(current_user), db: Session = Depends(get_db)):
    r = db.get(Report, rid)
    if not r or (u.role != "hse_admin" and r.reporter_id != u.id): raise HTTPException(404, "Report not found")
    store_analysis(db, r); db.commit(); return out(db, r)["analysis"]


@app.get("/api/ai/result/{rid}")
def result(rid: int, u: User = Depends(current_user), db: Session = Depends(get_db)):
    return get_report(rid, u, db)["analysis"]


@app.post("/api/reports/batch")
async def batch(file: UploadFile = File(...), u: User = Depends(admin_only), db: Session = Depends(get_db)):
    """CSV columns: Report ID, Date, Site, Location, Report Type, Activity, Description"""
    if not (file.filename or "").lower().endswith(".csv"): raise HTTPException(400, "Only .csv is supported in this prototype")
    rows = list(csv.DictReader(io.StringIO((await file.read()).decode("utf-8-sig"))))
    ok = failed = sif = 0
    for row in rows:
        try:
            r = make_report(db, u.id, report_type=row["Report Type"], date=row["Date"], site=row["Site"],
                            location=row["Location"], activity=row.get("Activity", ""), description=row["Description"])
            sif += bool(db.query(Analysis).filter_by(report_id=r.id).first().sif_prediction); ok += 1
        except Exception: db.rollback(); failed += 1
    db.commit()
    return {"total": len(rows), "processed": ok, "failed": failed, "sif": sif, "non_sif": ok - sif}


def all_rows(db):
    return [out(db, r) for r in db.query(Report).all()]


@app.get("/api/dashboard/summary")
def summary(u: User = Depends(admin_only), db: Session = Depends(get_db)):
    rows = all_rows(db); s = [x for x in rows if x["analysis"]["sif_potential"] == "YES"]
    cnt = lambda xs, k: dict(Counter(k(x) for x in xs))
    return {"total": len(rows), "sif": len(s), "non_sif": len(rows) - len(s),
            "high_priority": sum(x["analysis"]["priority"] == "High" for x in rows),
            "pending_review": sum(x["review"]["status"] == "Pending Review" for x in rows),
            "by_type": cnt(rows, lambda x: x["type"]), "sif_by_activity": cnt(s, lambda x: x["activity"]),
            "by_site": {k: {"total": sum(y["site"] == k for y in rows), "sif": sum(y["site"] == k for y in s)} for k in {x["site"] for x in rows}},
            "disclaimer": DISCLAIMER}


@app.get("/api/dashboard/trends")
def trends(u: User = Depends(admin_only), db: Session = Depends(get_db)):
    m = defaultdict(lambda: {"total": 0, "sif": 0})
    for x in all_rows(db):
        k = x["date"][:7]; m[k]["total"] += 1; m[k]["sif"] += x["analysis"]["sif_potential"] == "YES"
    return [{"month": k, **v} for k, v in sorted(m.items())]


@app.get("/api/dashboard/life-saving-rules")
def rules(u: User = Depends(admin_only), db: Session = Depends(get_db)):
    return dict(Counter(x["analysis"]["life_saving_rule"] for x in all_rows(db) if x["analysis"]["sif_potential"] == "YES"))


@app.get("/api/dashboard/precursors")
def precursors(u: User = Depends(admin_only), db: Session = Depends(get_db)):
    s = [x for x in all_rows(db) if x["analysis"]["sif_potential"] == "YES"]
    top = lambda k: [{"name": n, "count": c} for n, c in Counter(k(x) for x in s).most_common(5)]
    return {"activities": top(lambda x: x["activity"]), "locations": top(lambda x: x["location"]),
            "barrier_failures": top(lambda x: x["analysis"]["barrier_failure"]), "hazards": top(lambda x: x["analysis"]["hazard"])}


def save_review(db, rid, b: ReviewIn, u):
    if b.status not in STATUSES: raise HTTPException(400, f"Status must be one of {STATUSES}")
    v = db.query(Review).filter_by(report_id=rid).first()
    if not v: raise HTTPException(404, "Report not found")
    v.status, v.comments, v.action_required, v.action_owner = b.status, b.comments, b.action_required, b.action_owner
    v.reviewer_id, v.review_date = u.id, dt.datetime.utcnow()
    db.commit(); return out(db, db.get(Report, rid))


@app.post("/api/reviews")
def add_review(report_id: int, b: ReviewIn, u: User = Depends(admin_only), db: Session = Depends(get_db)):
    return save_review(db, report_id, b, u)


@app.put("/api/reviews/{report_id}")
def update_review(report_id: int, b: ReviewIn, u: User = Depends(admin_only), db: Session = Depends(get_db)):
    return save_review(db, report_id, b, u)
