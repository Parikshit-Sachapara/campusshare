import os
import sys
import uuid
from datetime import datetime, timedelta, timezone, time
import bcrypt

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from app.database import SessionLocal, engine
from app.models import (
    Department,
    Profile,
    ResourceCategory,
    Resource,
    ResourceUnit,
    ResourceImage,
    ResourceRule,
    ResourceAvailability,
    Training,
    TrainingRecord,
    Booking,
    BookingCondition,
    Incident,
    Notification,
    AuditLog,
    UsageLimit,
    PlatformSetting,
    UserRole,
    ResourceType,
    ResourceStatus,
    UnitCondition,
    BookingStatus,
    ConditionPhase,
    IncidentType,
    IncidentSeverity,
    IncidentStatus,
    LimitScope,
)

def hash_pw(pw: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pw.encode('utf-8'), salt).decode('utf-8')

def seed():
    session = SessionLocal()
    print("🌱 Starting CampusShare Idempotent Seed Process...")

    COMMON_PW = hash_pw("Campus@123")
    now = datetime.now(timezone.utc)

    # -------------------------------------------------------------
    # 1. DEPARTMENTS
    # -------------------------------------------------------------
    departments_data = [
        {"name": "Computer Science", "code": "CS", "description": "High Performance Computing, AI, and Software Engineering Labs"},
        {"name": "Electronics", "code": "EC", "description": "VLSI Design, Embedded Systems, and Circuit Prototyping"},
        {"name": "Mechanical Engineering", "code": "ME", "description": "Makerspace, CNC Fabrication, Additive Manufacturing & Robotics"},
        {"name": "Media", "code": "MD", "description": "Cinema Production, Photography Studio, Sound & Lighting Labs"},
        {"name": "Physics", "code": "PH", "description": "Optics, Condensed Matter, and Advanced Instrumentation Bench"},
    ]

    dept_map = {}
    for d in departments_data:
        obj = session.query(Department).filter_by(code=d["code"]).first()
        if not obj:
            obj = Department(name=d["name"], code=d["code"], description=d["description"])
            session.add(obj)
            session.flush()
        dept_map[d["code"]] = obj
    print(f"✓ {len(dept_map)} Departments verified.")

    # -------------------------------------------------------------
    # 2. RESOURCE CATEGORIES (All 9 disciplines)
    # -------------------------------------------------------------
    categories_data = [
        ("Computing", "computing", 1),
        ("Electronics", "electronics", 2),
        ("Robotics", "robotics", 3),
        ("Photography", "photography", 4),
        ("Laboratories", "laboratories", 5),
        ("Classrooms", "classrooms", 6),
        ("Audio/Visual", "audio_visual", 7),
        ("Manufacturing", "manufacturing", 8),
        ("Sports", "sports", 9),
    ]

    cat_map = {}
    for name, icon, order in categories_data:
        obj = session.query(ResourceCategory).filter_by(name=name).first()
        if not obj:
            obj = ResourceCategory(name=name, icon_key=icon, sort_order=order)
            session.add(obj)
            session.flush()
        cat_map[name] = obj
    print(f"✓ {len(cat_map)} Categories verified.")

    # -------------------------------------------------------------
    # 3. USERS (Demanded seed personas with Campus@123)
    # -------------------------------------------------------------
    users_data = [
        {
            "email": "student1@campusshare.demo",
            "full_name": "Aarav Mehta",
            "role": UserRole.STUDENT,
            "dept": "EC",
            "student_id": "ST-2024-8841",
            "phone": "+91 98201 12345",
        },
        {
            "email": "student2@campusshare.demo",
            "full_name": "Diya Patel",
            "role": UserRole.STUDENT,
            "dept": "CS",
            "student_id": "ST-2024-8842",
            "phone": "+91 98201 23456",
        },
        {
            "email": "student3@campusshare.demo",
            "full_name": "Kabir Shah",
            "role": UserRole.STUDENT,
            "dept": "MD",
            "student_id": "ST-2024-8843",
            "phone": "+91 98201 34567",
        },
        {
            "email": "owner@campusshare.demo",
            "full_name": "Ritu Nair",
            "role": UserRole.OWNER,
            "dept": "MD",
            "student_id": "FAC-5501",
            "phone": "+91 98201 45678",
        },
        {
            "email": "owner2@campusshare.demo",
            "full_name": "Manish Joshi",
            "role": UserRole.OWNER,
            "dept": "EC",
            "student_id": "FAC-5502",
            "phone": "+91 98201 56789",
        },
        {
            "email": "manager@campusshare.demo",
            "full_name": "Dr. Sunita Rao",
            "role": UserRole.MANAGER,
            "dept": "ME",
            "student_id": "MGR-1001",
            "phone": "+91 98201 67890",
        },
        {
            "email": "admin@campusshare.demo",
            "full_name": "Platform Administrator",
            "role": UserRole.ADMIN,
            "dept": "CS",
            "student_id": "ADM-0001",
            "phone": "+91 98201 78901",
        },
    ]

    user_map = {}
    for u in users_data:
        obj = session.query(Profile).filter_by(email=u["email"]).first()
        if not obj:
            obj = Profile(
                email=u["email"],
                password_hash=COMMON_PW,
                full_name=u["full_name"],
                role=u["role"],
                department_id=dept_map[u["dept"]].id,
                student_id=u["student_id"],
                phone=u["phone"],
                is_active=True,
                is_verified=True,
                avatar_url=f"https://api.dicebear.com/7.x/bottts/svg?seed={u['email']}",
            )
            session.add(obj)
            session.flush()
        user_map[u["email"]] = obj
    print(f"✓ {len(user_map)} Demo Users verified with credentials.")

    # -------------------------------------------------------------
    # 4. TRAININGS & PREREQUISITES
    # -------------------------------------------------------------
    trainings_data = [
        ("DSLR & Studio Production Safety", "Studio safety, lens handling, battery maintenance, and camera calibration protocols."),
        ("3D Printing & Additive Manufacturing Safety", "Filament loading, SLA resin handling, post-cure processing, and nozzle thermal safety."),
        ("Laser Cutter & High Power Optics", "Fume extraction, vector cutting safety, lens maintenance, and approved material standards."),
        ("Cleanroom & Chemical Laboratory Protocol", "Personal protective equipment, fume hood airflow, and hazard waste disposal."),
    ]

    training_map = {}
    for name, desc in trainings_data:
        obj = session.query(Training).filter_by(name=name).first()
        if not obj:
            obj = Training(name=name, description=desc)
            session.add(obj)
            session.flush()
        training_map[name] = obj

    # student1 has DSLR + 3D printer safety
    # student2 has NONE (used for eligibility-fail demo)
    student1 = user_map["student1@campusshare.demo"]
    for t_name in ["DSLR & Studio Production Safety", "3D Printing & Additive Manufacturing Safety"]:
        t_obj = training_map[t_name]
        rec = session.query(TrainingRecord).filter_by(user_id=student1.id, training_id=t_obj.id).first()
        if not rec:
            rec = TrainingRecord(
                user_id=student1.id,
                training_id=t_obj.id,
                completed_at=now - timedelta(days=60),
                expires_at=now + timedelta(days=300),
                verified_by=user_map["manager@campusshare.demo"].id,
            )
            session.add(rec)
    session.flush()
    print("✓ Training records initialized (student1 trained in DSLR & 3D Printing; student2 untrained).")

    # -------------------------------------------------------------
    # 5. RESOURCES (~14 with realistic specs, rules, units)
    # -------------------------------------------------------------
    owner1 = user_map["owner@campusshare.demo"]
    owner2 = user_map["owner2@campusshare.demo"]

    resources_data = [
        # 1. Canon EOS DSLR
        {
            "name": "Canon EOS DSLR Camera Kit",
            "desc": "Professional full-frame DSLR kit with 24-105mm f/4L lens, battery grip, dual 128GB SD cards, and carry case.",
            "cat": "Photography",
            "dept": "MD",
            "owner": owner1,
            "loc": "Media Studio Room 102",
            "type": ResourceType.EQUIPMENT,
            "qty": 1,
            "cap": None,
            "deposit": 500.00,
            "approval": True,
            "training": True,
            "training_name": "DSLR & Studio Production Safety",
            "restricted": False,
            "min_m": 60,
            "max_m": 240,
            "slot_m": 60,
            "adv_days": 14,
            "specs": {"sensor": "Full Frame 30.4MP", "mount": "Canon EF", "video": "4K DCI 30fps"},
            "unit_prefix": "CAM",
            "img": "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80",
        },
        # 2. Arduino Uno Kits
        {
            "name": "Arduino Uno Rev3 Prototyping Kits",
            "desc": "Complete starter kit containing ATmega328P board, breadboards, jumper wires, sensors, and actuator modules.",
            "cat": "Electronics",
            "dept": "EC",
            "owner": owner2,
            "loc": "Faraday Lab Cabinet 3",
            "type": ResourceType.EQUIPMENT,
            "qty": 6,
            "cap": None,
            "deposit": 0.00,
            "approval": False,
            "training": False,
            "training_name": None,
            "restricted": False,
            "min_m": 30,
            "max_m": 180,
            "slot_m": 30,
            "adv_days": 7,
            "specs": {"mcu": "ATmega328P", "io": "14 digital, 6 analog", "voltage": "5V"},
            "unit_prefix": "ARD",
            "img": "https://images.unsplash.com/photo-1553406830-ef2513450d76?auto=format&fit=crop&w=800&q=80",
        },
        # 3. Raspberry Pi 4 Kits
        {
            "name": "Raspberry Pi 4 Model B (8GB RAM)",
            "desc": "Quad-core Cortex-A72 SBC with preloaded Linux OS, official touch display, micro-HDMI cable, and power adapter.",
            "cat": "Electronics",
            "dept": "EC",
            "owner": owner2,
            "loc": "Embedded Systems Lab Shelf B",
            "type": ResourceType.EQUIPMENT,
            "qty": 4,
            "cap": None,
            "deposit": 0.00,
            "approval": False,
            "training": False,
            "training_name": None,
            "restricted": False,
            "min_m": 30,
            "max_m": 240,
            "slot_m": 30,
            "adv_days": 7,
            "specs": {"ram": "8GB LPDDR4", "cpu": "Broadcom BCM2711 1.5GHz", "ports": "Dual 4K micro-HDMI, Gigabit Eth"},
            "unit_prefix": "RPI",
            "img": "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80",
        },
        # 4. Epson Projector
        {
            "name": "Epson Pro EX9240 Wireless 3LCD Projector",
            "desc": "4,000 lumens Full HD 1080p wireless business and classroom projector with HDMI and Miracast connectivity.",
            "cat": "Audio/Visual",
            "dept": "MD",
            "owner": owner1,
            "loc": "AV Central Store Rm 204",
            "type": ResourceType.EQUIPMENT,
            "qty": 2,
            "cap": None,
            "deposit": 0.00,
            "approval": False,
            "training": False,
            "training_name": None,
            "restricted": False,
            "min_m": 60,
            "max_m": 240,
            "slot_m": 60,
            "adv_days": 10,
            "specs": {"lumens": "4000 lumens", "resolution": "1920x1080", "tech": "3-chip 3LCD"},
            "unit_prefix": "PRJ",
            "img": "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=800&q=80",
        },
        # 5. High-performance Laptop
        {
            "name": "Dell Precision Mobile Workstation",
            "desc": "Intel Core i9, 32GB RAM, NVIDIA RTX A2000 GPU laptop optimized for CAD, 3D simulation and machine learning.",
            "cat": "Computing",
            "dept": "CS",
            "owner": owner1,
            "loc": "Turing Commons Equipment Hub",
            "type": ResourceType.EQUIPMENT,
            "qty": 3,
            "cap": None,
            "deposit": 0.00,
            "approval": False,
            "training": False,
            "training_name": None,
            "restricted": False,
            "min_m": 60,
            "max_m": 360,
            "slot_m": 60,
            "adv_days": 7,
            "specs": {"cpu": "Core i9-13900H", "gpu": "RTX A2000 8GB", "ram": "32GB DDR5"},
            "unit_prefix": "LAP",
            "img": "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=800&q=80",
        },
        # 6. Electronics Laboratory (Facility)
        {
            "name": "Electronics Main Workstation Lab",
            "desc": "Shared practical laboratory equipped with 15 dual-seat solder and test benches with ESD protection mats.",
            "cat": "Laboratories",
            "dept": "EC",
            "owner": owner2,
            "loc": "Maxwell Hall Rm 110",
            "type": ResourceType.FACILITY,
            "qty": 1,
            "cap": 30,
            "deposit": 0.00,
            "approval": False,
            "training": False,
            "training_name": None,
            "restricted": False,
            "min_m": 60,
            "max_m": 180,
            "slot_m": 60,
            "adv_days": 14,
            "specs": {"stations": "15 Benches", "safety": "ESD-Safe, Emergency Power Cutoff", "ventilation": "Active Fume Exhaust"},
            "unit_prefix": "ELAB",
            "img": "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80",
        },
        # 7. Robotics Laboratory (Facility, restricted)
        {
            "name": "Advanced Autonomous Robotics Arena",
            "desc": "Restricted research facility featuring motion capture gantries, drone flight cage, and robot arm test platforms.",
            "cat": "Robotics",
            "dept": "ME",
            "owner": owner2,
            "loc": "Engineering Complex Ground Level",
            "type": ResourceType.FACILITY,
            "qty": 1,
            "cap": 20,
            "deposit": 0.00,
            "approval": True,
            "training": False,
            "training_name": None,
            "restricted": True,
            "min_m": 60,
            "max_m": 240,
            "slot_m": 60,
            "adv_days": 14,
            "specs": {"mocap": "8x OptiTrack Cameras", "floor": "Safety Mesh Enclosure", "air": "Pneumatic 6-Bar Line"},
            "unit_prefix": "ROBO",
            "img": "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=800&q=80",
        },
        # 8. Seminar Hall (Facility)
        {
            "name": "Aryabhata Tiered Seminar Hall",
            "desc": "Auditorium space with dual 4K laser projection, conference mic array, lecture recording system, and tiered acoustics.",
            "cat": "Classrooms",
            "dept": "CS",
            "owner": owner1,
            "loc": "Academic Block A, 1st Fl",
            "type": ResourceType.FACILITY,
            "qty": 1,
            "cap": 120,
            "deposit": 0.00,
            "approval": True,
            "training": False,
            "training_name": None,
            "restricted": False,
            "min_m": 60,
            "max_m": 240,
            "slot_m": 60,
            "adv_days": 21,
            "specs": {"capacity": "120 Seats", "sound": "Dante Networked Audio", "screens": "Dual 150-inch Motorized"},
            "unit_prefix": "SEM",
            "img": "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=800&q=80",
        },
        # 9. 3D Printer
        {
            "name": "Formlabs Form 3+ SLA 3D Printer",
            "desc": "Industrial stereolithography 3D printer for ultra-smooth surface prototypes and biocompatible resins.",
            "cat": "Manufacturing",
            "dept": "ME",
            "owner": owner2,
            "loc": "Makerspace Pod A",
            "type": ResourceType.EQUIPMENT,
            "qty": 1,
            "cap": None,
            "deposit": 0.00,
            "approval": True,
            "training": True,
            "training_name": "3D Printing & Additive Manufacturing Safety",
            "restricted": False,
            "min_m": 60,
            "max_m": 360,
            "slot_m": 60,
            "adv_days": 10,
            "specs": {"build_volume": "145 × 145 × 185 mm", "layer_thickness": "25 - 300 microns", "laser_power": "250mW"},
            "unit_prefix": "PRN",
            "img": "https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=800&q=80",
        },
        # 10. Oscilloscope
        {
            "name": "Keysight InfiniiVision 4-Ch Oscilloscope",
            "desc": "1 GHz bandwidth, 5 GSa/s digital storage oscilloscope with SPI, I2C, and CAN bus decode licenses.",
            "cat": "Electronics",
            "dept": "EC",
            "owner": owner2,
            "loc": "Faraday Lab Bench 07",
            "type": ResourceType.EQUIPMENT,
            "qty": 3,
            "cap": None,
            "deposit": 0.00,
            "approval": False,
            "training": False,
            "training_name": None,
            "restricted": False,
            "min_m": 30,
            "max_m": 180,
            "slot_m": 30,
            "adv_days": 7,
            "specs": {"bandwidth": "1 GHz", "channels": "4 Analog + 16 Digital", "sample_rate": "5 GSa/s"},
            "unit_prefix": "OSC",
            "img": "https://images.unsplash.com/photo-1581092162384-8987c1d64718?auto=format&fit=crop&w=800&q=80",
        },
        # 11. Tripod set
        {
            "name": "Manfrotto Professional Video Tripod Kit",
            "desc": "Heavy-duty carbon fiber twin leg video tripod with 504X fluid head, ground spreader, and 12kg payload support.",
            "cat": "Photography",
            "dept": "MD",
            "owner": owner1,
            "loc": "Media Studio Equipment Locker",
            "type": ResourceType.EQUIPMENT,
            "qty": 4,
            "cap": None,
            "deposit": 0.00,
            "approval": False,
            "training": False,
            "training_name": None,
            "restricted": False,
            "min_m": 60,
            "max_m": 240,
            "slot_m": 60,
            "adv_days": 7,
            "specs": {"max_height": "165 cm", "payload": "12 kg", "material": "Carbon Fiber"},
            "unit_prefix": "TRP",
            "img": "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=800&q=80",
        },
        # 12. Wireless microphone kit
        {
            "name": "RØDE Wireless PRO Dual Wireless Mic Kit",
            "desc": "32-bit float dual-channel wireless microphone system with onboard recording, lavalier mics, and charging case.",
            "cat": "Audio/Visual",
            "dept": "MD",
            "owner": owner1,
            "loc": "Media Sound Locker",
            "type": ResourceType.EQUIPMENT,
            "qty": 2,
            "cap": None,
            "deposit": 0.00,
            "approval": False,
            "training": False,
            "training_name": None,
            "restricted": False,
            "min_m": 60,
            "max_m": 240,
            "slot_m": 60,
            "adv_days": 7,
            "specs": {"range": "260m line-of-sight", "audio": "32-bit float on-board", "battery": "7h + charging case"},
            "unit_prefix": "MIC",
            "img": "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=800&q=80",
        },
        # 13. Badminton kit
        {
            "name": "Yonex Tournament Badminton Set (4 Racquets + Shuttles)",
            "desc": "Astrox 88D Pro racquets with feather shuttlecocks, court net, and carry bag for campus recreational or tournament play.",
            "cat": "Sports",
            "dept": "MD",
            "owner": owner1,
            "loc": "Campus Sports Complex Desk",
            "type": ResourceType.EQUIPMENT,
            "qty": 4,
            "cap": None,
            "deposit": 0.00,
            "approval": False,
            "training": False,
            "training_name": None,
            "restricted": False,
            "min_m": 60,
            "max_m": 120,
            "slot_m": 60,
            "adv_days": 3,
            "specs": {"racquets": "4x Yonex Astrox 88D Pro", "shuttles": "Aerosensa 30", "tension": "26 lbs"},
            "unit_prefix": "SP-BAD",
            "img": "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=800&q=80",
        },
        # 14. Physics optics bench
        {
            "name": "Thorlabs High-Stability Optical Rail Bench",
            "desc": "Precision 2-meter optical breadboard rail with kinematic mirror mounts, He-Ne laser source, and photodetector array.",
            "cat": "Laboratories",
            "dept": "PH",
            "owner": owner2,
            "loc": "C.V. Raman Physics Laboratory Bench 4",
            "type": ResourceType.EQUIPMENT,
            "qty": 1,
            "cap": None,
            "deposit": 0.00,
            "approval": True,
            "training": False,
            "training_name": None,
            "restricted": False,
            "min_m": 60,
            "max_m": 180,
            "slot_m": 60,
            "adv_days": 14,
            "specs": {"length": "2.0 meters", "laser": "632.8 nm He-Ne", "isolation": "Pneumatic Damping"},
            "unit_prefix": "OPT",
            "img": "https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=800&q=80",
        },
    ]

    resource_map = {}
    unit_list = []

    for r_data in resources_data:
        r_obj = session.query(Resource).filter_by(name=r_data["name"]).first()
        if not r_obj:
            r_obj = Resource(
                name=r_data["name"],
                description=r_data["desc"],
                category_id=cat_map[r_data["cat"]].id,
                department_id=dept_map[r_data["dept"]].id,
                owner_id=r_data["owner"].id,
                location=r_data["loc"],
                resource_type=r_data["type"],
                quantity=r_data["qty"],
                capacity=r_data["cap"],
                status=ResourceStatus.AVAILABLE,
                deposit_amount=r_data["deposit"],
                approval_required=r_data["approval"],
                training_required=r_data["training"],
                is_restricted=r_data["restricted"],
                min_booking_minutes=r_data["min_m"],
                max_booking_minutes=r_data["max_m"],
                slot_minutes=r_data["slot_m"],
                advance_booking_days=r_data["adv_days"],
                specifications=r_data["specs"],
            )
            session.add(r_obj)
            session.flush()

            # Add primary image
            img = ResourceImage(
                resource_id=r_obj.id,
                url=r_data["img"],
                is_primary=True,
                sort_order=1,
            )
            session.add(img)

            # Add resource rule
            tr_id = training_map[r_data["training_name"]].id if r_data["training_name"] else None
            rule = ResourceRule(
                resource_id=r_obj.id,
                allowed_department_ids=[],
                allowed_roles=["STUDENT", "OWNER", "MANAGER", "ADMIN"],
                required_training_id=tr_id,
                requires_faculty_approval=r_data["approval"],
                usage_instructions="Handle with care according to campus laboratory safety manual.",
            )
            session.add(rule)

            # Add default operating hours (Monday to Friday, 8am - 6pm)
            for day in range(5):
                av = ResourceAvailability(
                    resource_id=r_obj.id,
                    day_of_week=day,
                    open_time=time(8, 0),
                    close_time=time(18, 0),
                )
                session.add(av)

            # Create physical units:
            # Equipment with quantity N has N units. Facilities have exactly 1 unit.
            num_units = 1 if r_data["type"] == ResourceType.FACILITY else r_data["qty"]
            for i in range(1, num_units + 1):
                code = f"{r_data['unit_prefix']}-{i:03d}"
                unit = ResourceUnit(
                    resource_id=r_obj.id,
                    unit_code=code,
                    condition=UnitCondition.EXCELLENT,
                    is_active=True,
                )
                session.add(unit)
                unit_list.append(unit)
        else:
            # Fetch existing units
            existing_units = session.query(ResourceUnit).filter_by(resource_id=r_obj.id).all()
            unit_list.extend(existing_units)

        resource_map[r_data["name"]] = r_obj

    session.flush()
    print(f"✓ {len(resource_map)} Resources with units and availability rules verified.")

    # -------------------------------------------------------------
    # 6. HISTORICAL BOOKINGS (~60 across last 8 weeks) & UPCOMING
    # -------------------------------------------------------------
    print("Generating realistic historical and upcoming bookings...")
    student1 = user_map["student1@campusshare.demo"]
    student2 = user_map["student2@campusshare.demo"]
    student3 = user_map["student3@campusshare.demo"]
    manager_user = user_map["manager@campusshare.demo"]

    students = [student1, student2, student3]

    # Check if bookings already exist
    existing_count = session.query(Booking).count()
    if existing_count < 10:
        booking_counter = 1001

        # 1. SPECIAL UPCOMING APPROVED BOOKING FOR STUDENT 1 (Check-in Ready Demo)
        canon_res = resource_map["Canon EOS DSLR Camera Kit"]
        canon_unit = session.query(ResourceUnit).filter_by(resource_id=canon_res.id).first()

        upcoming_start = now + timedelta(hours=2)
        upcoming_end = upcoming_start + timedelta(hours=3)

        upcoming_booking = Booking(
            booking_code="CS-2026-00042",
            student_id=student1.id,
            resource_id=canon_res.id,
            unit_id=canon_unit.id,
            start_ts=upcoming_start,
            end_ts=upcoming_end,
            attendees=1,
            purpose="Documenting Autonomous Swarm Prototype for National Robotics Hackathon.",
            project_name="SwarmBot-26",
            status=BookingStatus.APPROVED,
            approver_id=manager_user.id,
            approved_at=now - timedelta(hours=1),
            priority_score=94.50,
            priority_breakdown={"need": 38, "disadvantage": 24, "efficiency": 18, "accountability": 14.5},
            version=1,
        )
        session.add(upcoming_booking)

        # 2. GENERATE ~60 HISTORICAL SPREAD BOOKINGS
        # We step backwards over 56 days (8 weeks)
        statuses_distribution = [
            BookingStatus.COMPLETED,
            BookingStatus.COMPLETED,
            BookingStatus.COMPLETED,
            BookingStatus.COMPLETED,
            BookingStatus.COMPLETED,
            BookingStatus.REJECTED,
            BookingStatus.CANCELLED,
            BookingStatus.OVERDUE,
            BookingStatus.INCIDENT_REPORTED,
            BookingStatus.CHECKED_OUT,
        ]

        all_units = session.query(ResourceUnit).all()

        for day_offset in range(1, 56):
            # 1 to 2 bookings per day
            for daily_idx in range(1 if day_offset % 2 == 0 else 2):
                chosen_unit = all_units[(day_offset * 3 + daily_idx) % len(all_units)]
                chosen_res = session.query(Resource).filter_by(id=chosen_unit.resource_id).first()
                chosen_student = students[(day_offset + daily_idx) % len(students)]
                status_choice = statuses_distribution[(day_offset + daily_idx) % len(statuses_distribution)]

                b_start = now - timedelta(days=day_offset, hours=(10 + daily_idx * 3))
                b_end = b_start + timedelta(hours=2)

                b_code = f"CS-2026-{booking_counter:05d}"
                booking_counter += 1

                score = round(60 + (day_offset * 7) % 38, 1)

                b_entry = Booking(
                    booking_code=b_code,
                    student_id=chosen_student.id,
                    resource_id=chosen_res.id,
                    unit_id=chosen_unit.id,
                    start_ts=b_start,
                    end_ts=b_end,
                    attendees=1 if chosen_res.resource_type == ResourceType.EQUIPMENT else 12,
                    purpose=f"Academic curriculum lab coursework #{daily_idx + 1}",
                    project_name=f"Project-{chosen_res.name[:6].strip()}",
                    status=status_choice,
                    priority_score=score,
                    priority_breakdown={"need": round(score*0.4, 1), "disadvantage": round(score*0.25, 1), "efficiency": round(score*0.2, 1), "accountability": round(score*0.15, 1)},
                    approver_id=manager_user.id if status_choice != BookingStatus.PENDING else None,
                    approved_at=b_start - timedelta(hours=4) if status_choice != BookingStatus.PENDING else None,
                    collected_at=b_start + timedelta(minutes=5) if status_choice in [BookingStatus.CHECKED_OUT, BookingStatus.COMPLETED, BookingStatus.OVERDUE, BookingStatus.INCIDENT_REPORTED] else None,
                    returned_at=b_end if status_choice == BookingStatus.COMPLETED else None,
                    rejection_reason="Equipment reserved for departmental thesis presentation." if status_choice == BookingStatus.REJECTED else None,
                    cancellation_reason="Student had scheduling conflict with midterm exam." if status_choice == BookingStatus.CANCELLED else None,
                    version=1,
                    created_at=b_start - timedelta(days=2),
                )
                session.add(b_entry)
                session.flush()

                # Add condition inspection for completed bookings
                if status_choice == BookingStatus.COMPLETED:
                    pickup_cond = BookingCondition(
                        booking_id=b_entry.id,
                        phase=ConditionPhase.PICKUP,
                        condition=UnitCondition.EXCELLENT,
                        notes="Passed visual inspection upon desk release.",
                        recorded_by=owner1.id,
                        student_confirmed=True,
                        created_at=b_start,
                    )
                    return_cond = BookingCondition(
                        booking_id=b_entry.id,
                        phase=ConditionPhase.RETURN,
                        condition=UnitCondition.EXCELLENT,
                        notes="Returned intact with all accessories.",
                        recorded_by=owner1.id,
                        student_confirmed=True,
                        created_at=b_end,
                    )
                    session.add_all([pickup_cond, return_cond])

        session.commit()
        print("✓ ~60 Historical bookings and 1 active upcoming approved booking seeded.")

    # -------------------------------------------------------------
    # 7. INCIDENTS (3 in different states)
    # -------------------------------------------------------------
    incidents_count = session.query(Incident).count()
    if incidents_count == 0:
        dslr_res = resource_map["Canon EOS DSLR Camera Kit"]
        osc_res = resource_map["Keysight InfiniiVision 4-Ch Oscilloscope"]
        proj_res = resource_map["Epson Pro EX9240 Wireless 3LCD Projector"]

        incidents_data = [
            {
                "res": dslr_res,
                "reporter": owner1,
                "type": IncidentType.DAMAGE,
                "severity": IncidentSeverity.MEDIUM,
                "desc": "Fine cosmetic scratch discovered on front protective UV filter after field photography return. Lens glass element is unharmed.",
                "evidence": ["https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=400&q=80"],
                "status": IncidentStatus.REPORTED,
                "reviewer": None,
                "resolution": None,
            },
            {
                "res": osc_res,
                "reporter": owner2,
                "type": IncidentType.LATE_RETURN,
                "severity": IncidentSeverity.LOW,
                "desc": "Equipment returned 45 minutes beyond agreed reservation window without prior extension request.",
                "evidence": [],
                "status": IncidentStatus.UNDER_REVIEW,
                "reviewer": manager_user,
                "resolution": None,
            },
            {
                "res": proj_res,
                "reporter": owner1,
                "type": IncidentType.MISSING,
                "severity": IncidentSeverity.LOW,
                "desc": "HDMI connecting cable missing from carrying case during return inspection.",
                "evidence": [],
                "status": IncidentStatus.RESOLVED,
                "reviewer": manager_user,
                "resolution": "Student located spare HDMI cable in seminar room and returned it the following morning. Incident closed with zero financial penalty.",
            },
        ]

        for inc in incidents_data:
            obj = Incident(
                resource_id=inc["res"].id,
                reporter_id=inc["reporter"].id,
                type=inc["type"],
                severity=inc["severity"],
                description=inc["desc"],
                evidence_urls=inc["evidence"],
                status=inc["status"],
                reviewer_id=inc["reviewer"].id if inc["reviewer"] else None,
                resolution=inc["resolution"],
                resolved_at=now - timedelta(days=3) if inc["status"] == IncidentStatus.RESOLVED else None,
            )
            session.add(obj)
        session.commit()
        print("✓ 3 Realistic incidents in varied states seeded.")

    # -------------------------------------------------------------
    # 8. NOTIFICATIONS & AUDIT LOGS
    # -------------------------------------------------------------
    if session.query(Notification).count() == 0:
        notifs = [
            Notification(
                user_id=student1.id,
                type="BOOKING_APPROVED",
                title="Pass Ready: Canon EOS DSLR Kit",
                body="Your reservation CS-2026-00042 has been approved. Present your digital pass at Media Studio Rm 102.",
                link="/bookings",
                is_read=False,
            ),
            Notification(
                user_id=student1.id,
                type="CERTIFICATION_EARNED",
                title="Safety Verified: DSLR Production",
                body="You completed DSLR & Studio Production Safety certification valid through next year.",
                link="/catalog",
                is_read=True,
            ),
            Notification(
                user_id=owner1.id,
                type="NEW_REQUEST",
                title="Pending Request: Sony FX3 Cinema Kit",
                body="Student Aarav Mehta requested 3.5 hours for Capstone Project.",
                link="/handover",
                is_read=False,
            ),
        ]
        session.add_all(notifs)
        session.commit()
        print("✓ Notifications seeded.")

    if session.query(AuditLog).count() == 0:
        logs = [
            AuditLog(
                actor_id=student1.id,
                actor_role="STUDENT",
                action="BOOKING_CREATED",
                entity_type="Booking",
                entity_id="CS-2026-00042",
                resource_id=resource_map["Canon EOS DSLR Camera Kit"].id,
                audit_metadata={"purpose": "National Hackathon Documentation", "priority": 94.5},
                ip="172.20.10.4",
            ),
            AuditLog(
                actor_id=manager_user.id,
                actor_role="MANAGER",
                action="BOOKING_APPROVED",
                entity_type="Booking",
                entity_id="CS-2026-00042",
                resource_id=resource_map["Canon EOS DSLR Camera Kit"].id,
                audit_metadata={"reviewer": "Dr. Sunita Rao", "notes": "Approved with priority tier 1"},
                ip="10.0.4.12",
            ),
            AuditLog(
                actor_id=user_map["admin@campusshare.demo"].id,
                actor_role="ADMIN",
                action="PLATFORM_INITIALIZATION",
                entity_type="System",
                entity_id="SYS-INIT",
                audit_metadata={"rules_enforced": True, "btree_gist_active": True},
                ip="127.0.0.1",
            ),
        ]
        session.add_all(logs)
        session.commit()
        print("✓ Audit trail seeded.")

    # -------------------------------------------------------------
    # 9. PLATFORM SETTINGS & USAGE LIMITS
    # -------------------------------------------------------------
    if not session.query(PlatformSetting).filter_by(key="fairness_weights").first():
        ps = PlatformSetting(
            key="fairness_weights",
            value={"N": 40, "D": 30, "E": 20, "A": 10},
        )
        session.add(ps)

    if not session.query(PlatformSetting).filter_by(key="lead_times").first():
        ps2 = PlatformSetting(
            key="lead_times",
            value={"reminder_hours_before": 2, "overdue_grace_minutes": 15, "waitlist_offer_expiry_hours": 3},
        )
        session.add(ps2)

    if session.query(UsageLimit).count() == 0:
        ul = UsageLimit(
            scope=LimitScope.GLOBAL,
            max_active_bookings=5,
            max_bookings_per_week=10,
            max_hours_per_week=25,
            no_show_threshold=2,
            no_show_cooldown_days=7,
        )
        session.add(ul)

    session.commit()
    session.close()
    print("✨ CampusShare Database Seeding Completed Successfully! All 18 tables populated.")

if __name__ == "__main__":
    seed()
