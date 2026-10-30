import os
import sys
import uuid
from datetime import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import (
    Resource,
    ResourceUnit,
    ResourceImage,
    ResourceRule,
    ResourceAvailability,
    ResourceCategory,
    Department,
    Profile,
    ResourceType,
    ResourceStatus,
    UnitCondition,
    UserRole,
)

def populate():
    db = SessionLocal()
    print("Beginning Comprehensive Catalog Expansion on Neon PostgreSQL...")

    # 1. Archive temporary test items so they don't appear in active searches
    test_items = db.query(Resource).filter(Resource.name.like("Acc Test DSLR%")).all()
    for t in test_items:
        t.status = ResourceStatus.ARCHIVED
    db.commit()
    print(f"Archived {len(test_items)} temporary test resources.")

    # 2. Get Department and Category maps
    departments = {d.code: d for d in db.query(Department).all()}
    categories = {c.name: c for c in db.query(ResourceCategory).all()}
    owner = db.query(Profile).filter_by(role=UserRole.OWNER).first()
    if not owner:
        owner = db.query(Profile).first()

    default_dept = departments.get("CS") or next(iter(departments.values()))

    # Define expansive catalog items
    catalog = [
        # --- COMPUTING ---
        {
            "name": "NVIDIA Jetson AGX Orin 64GB AI Developer Kit",
            "category": "Computing",
            "department": "CS",
            "type": ResourceType.EQUIPMENT,
            "quantity": 4,
            "unit_prefix": "JETSON-AGX",
            "location": "Turing AI Lab, Station 04",
            "description": "High-performance edge AI processor with 275 TOPS computing power. Supports ROS 2, PyTorch, TensorRT for computer vision and robotic perception.",
            "specifications": {"RAM": "64GB 256-bit LPDDR5", "GPU": "2048-core NVIDIA Ampere", "Storage": "64GB eMMC 5.1", "TDP": "15W - 60W"},
            "approval_required": True,
            "min_booking_minutes": 60,
            "max_booking_minutes": 480,
            "slot_minutes": 60,
            "image": "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=800&auto=format&fit=crop&q=80"
        },
        {
            "name": "Apple MacBook Pro 16\" M3 Max (64GB RAM / 1TB SSD)",
            "category": "Computing",
            "department": "CS",
            "type": ResourceType.EQUIPMENT,
            "quantity": 5,
            "unit_prefix": "MBP16-M3M",
            "location": "Software Engineering Hub Locker B",
            "description": "Premium mobile development workstation equipped with Xcode, Docker, PyTorch Metal acceleration, and complete software engineering toolchains.",
            "specifications": {"CPU": "16-core Apple M3 Max", "RAM": "64GB Unified Memory", "Storage": "1TB NVMe", "Screen": "Liquid Retina XDR 120Hz"},
            "approval_required": False,
            "min_booking_minutes": 60,
            "max_booking_minutes": 360,
            "slot_minutes": 60,
            "image": "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80"
        },
        {
            "name": "High-Performance GPU Cluster Node (4x NVIDIA A100 80GB)",
            "category": "Computing",
            "department": "CS",
            "type": ResourceType.FACILITY,
            "quantity": 1,
            "capacity": 8,
            "unit_prefix": "GPU-CLUSTER",
            "location": "Supercomputing Annex Room 012",
            "description": "Dedicated multi-GPU cluster node allocation for large language model fine-tuning, molecular dynamics, and massive scientific simulations.",
            "specifications": {"GPUs": "4x NVIDIA A100 Tensor Core 80GB", "Host RAM": "512GB ECC DDR4", "Interconnect": "NVLink 600 GB/s"},
            "approval_required": True,
            "min_booking_minutes": 120,
            "max_booking_minutes": 720,
            "slot_minutes": 60,
            "image": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80"
        },

        # --- ROBOTICS ---
        {
            "name": "Boston Dynamics Spot Quadruped Autonomous Robot",
            "category": "Robotics",
            "department": "ME",
            "type": ResourceType.EQUIPMENT,
            "quantity": 1,
            "unit_prefix": "SPOT-BOT",
            "location": "Robotics Lab Secure Bay 1",
            "description": "Agile mobile quadruped robot for autonomous terrain mapping, obstacle avoidance, SLAM, and sensor payload integration.",
            "specifications": {"Payload": "14 kg", "Speed": "1.6 m/s", "Sensors": "360-degree Stereo Cameras, Velodyne LiDAR", "Battery": "90 min runtime"},
            "approval_required": True,
            "min_booking_minutes": 60,
            "max_booking_minutes": 240,
            "slot_minutes": 60,
            "image": "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&auto=format&fit=crop&q=80"
        },
        {
            "name": "TurtleBot 4 Mobile Robot Platform (ROS 2 Humble)",
            "category": "Robotics",
            "department": "CS",
            "type": ResourceType.EQUIPMENT,
            "quantity": 4,
            "unit_prefix": "TB4-ROS2",
            "location": "Autonomous Systems Bay B",
            "description": "Open-source robotics research platform built on iRobot Create 3 and Raspberry Pi 4. Fully integrated with ROS 2, OAK-D stereo camera, and 2D LiDAR.",
            "specifications": {"Framework": "ROS 2 Humble", "Camera": "Luxonis OAK-D-Pro", "LiDAR": "RPLIDAR A1", "Payload": "9 kg"},
            "approval_required": False,
            "min_booking_minutes": 60,
            "max_booking_minutes": 300,
            "slot_minutes": 60,
            "image": "https://images.unsplash.com/photo-1561557944-6e7860d1a7eb?w=800&auto=format&fit=crop&q=80"
        },
        {
            "name": "Universal Robots UR5e 6-Axis Collaborative Robotic Arm",
            "category": "Robotics",
            "department": "ME",
            "type": ResourceType.EQUIPMENT,
            "quantity": 2,
            "unit_prefix": "UR5E-ARM",
            "location": "Industrial Automation & Mechatronics Lab",
            "description": "Industrial collaborative robotic arm with 5kg payload and 850mm reach. Ideal for precision pick-and-place, assembly, and trajectory planning research.",
            "specifications": {"Payload": "5 kg", "Reach": "850 mm", "Degrees of Freedom": "6 rotating joints", "Repeatability": "+/- 0.03 mm"},
            "approval_required": True,
            "min_booking_minutes": 60,
            "max_booking_minutes": 360,
            "slot_minutes": 60,
            "image": "https://images.unsplash.com/photo-1617788138017-80ad40651399?w=800&auto=format&fit=crop&q=80"
        },
        {
            "name": "Autonomous Drone Flight Arena (MoCap Tracking)",
            "category": "Robotics",
            "department": "ME",
            "type": ResourceType.FACILITY,
            "quantity": 1,
            "capacity": 10,
            "unit_prefix": "DRONE-ARENA",
            "location": "Engineering Complex Ground Level",
            "description": "12m x 8m enclosed netted aerial flight cage equipped with OptiTrack 12-camera motion capture system for millimeter-accuracy indoor quadcopter localization.",
            "specifications": {"Dimensions": "12m x 8m x 5m", "Tracking System": "12x OptiTrack Prime 13W", "Safety": "Full Kevlar netting enclosure"},
            "approval_required": True,
            "min_booking_minutes": 60,
            "max_booking_minutes": 240,
            "slot_minutes": 60,
            "image": "https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=800&auto=format&fit=crop&q=80"
        },

        # --- PHOTOGRAPHY & MEDIA ---
        {
            "name": "Sony Alpha A7 IV Full-Frame Mirrorless 4K Camera",
            "category": "Photography",
            "department": "MD",
            "type": ResourceType.EQUIPMENT,
            "quantity": 3,
            "unit_prefix": "SONY-A7IV",
            "location": "Media Production Studio Rm 102",
            "description": "33MP full-frame Exmor R CMOS sensor with 4K 60p 10-bit 4:2:2 video capture, real-time eye autofocus, and 5-axis in-body image stabilization.",
            "specifications": {"Sensor": "33MP Full-Frame Exmor R", "Video": "4K 60p 10-bit 4:2:2", "AF": "759 phase-detection points", "Mount": "Sony E-mount"},
            "approval_required": False,
            "min_booking_minutes": 60,
            "max_booking_minutes": 360,
            "slot_minutes": 60,
            "image": "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&auto=format&fit=crop&q=80"
        },
        {
            "name": "Sony FE 24-70mm f/2.8 GM II Telephoto Zoom Lens",
            "category": "Photography",
            "department": "MD",
            "type": ResourceType.EQUIPMENT,
            "quantity": 4,
            "unit_prefix": "LENS-2470GM",
            "location": "Media Production Studio Cabinet A",
            "description": "Constant f/2.8 aperture G Master standard zoom lens. Extreme optical sharpness, four XD linear motors for silent autofocus, and dust/moisture resistance.",
            "specifications": {"Focal Length": "24-70mm", "Max Aperture": "f/2.8", "Filter Size": "82 mm", "Weight": "695 g"},
            "approval_required": False,
            "min_booking_minutes": 60,
            "max_booking_minutes": 360,
            "slot_minutes": 60,
            "image": "https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=800&auto=format&fit=crop&q=80"
        },
        {
            "name": "DJI RS 3 Pro Handheld Gimbal Stabilizer Combo",
            "category": "Photography",
            "department": "MD",
            "type": ResourceType.EQUIPMENT,
            "quantity": 3,
            "unit_prefix": "DJI-RS3P",
            "location": "Media Sound & Video Locker",
            "description": "Automated axis locks, carbon fiber construction, 4.5kg payload capacity, and LiDAR focusing assistance for cinema-grade camera stabilization.",
            "specifications": {"Payload": "4.5 kg", "Weight": "1.5 kg", "Battery Life": "12 hours", "Connectivity": "Bluetooth 5.0, USB-C"},
            "approval_required": False,
            "min_booking_minutes": 60,
            "max_booking_minutes": 300,
            "slot_minutes": 60,
            "image": "https://images.unsplash.com/photo-1502982720700-bfff97f2ecac?w=800&auto=format&fit=crop&q=80"
        },
        {
            "name": "Godox SL200III LED Video Light & Softbox Set (2-Light Kit)",
            "category": "Photography",
            "department": "MD",
            "type": ResourceType.EQUIPMENT,
            "quantity": 3,
            "unit_prefix": "GODOX-SL200",
            "location": "Photo Studio Rm 105",
            "description": "215W continuous daylight-balanced 5600K LED studio lights with Bowens mount, silent fan mode, CRI 96 / TLCI 97 for professional color fidelity.",
            "specifications": {"Output": "215W", "Color Temp": "5600K +/- 200K", "CRI": "96+", "Mount": "Bowens S-Type"},
            "approval_required": False,
            "min_booking_minutes": 60,
            "max_booking_minutes": 360,
            "slot_minutes": 60,
            "image": "https://images.unsplash.com/photo-1527011046414-4781f1f94f8c?w=800&auto=format&fit=crop&q=80"
        },

        # --- ELECTRONICS ---
        {
            "name": "Rigol DP832 Triple Output Programmable DC Power Supply",
            "category": "Electronics",
            "department": "EC",
            "type": ResourceType.EQUIPMENT,
            "quantity": 5,
            "unit_prefix": "RIGOL-DP832",
            "location": "Hardware Prototyping Bench 12",
            "description": "3-channel programmable precision bench DC power supply (30V/3A, 30V/3A, 5V/3A, total 195W) with low ripple and noise (<350uVrms).",
            "specifications": {"Channels": "3 isolated outputs", "Total Power": "195W", "Resolution": "1mV / 1mA", "Interface": "USB, LAN"},
            "approval_required": False,
            "min_booking_minutes": 60,
            "max_booking_minutes": 360,
            "slot_minutes": 60,
            "image": "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80"
        },
        {
            "name": "Hakko FX-888D Digital Soldering & Rework Station",
            "category": "Electronics",
            "department": "EC",
            "type": ResourceType.EQUIPMENT,
            "quantity": 6,
            "unit_prefix": "HAKKO-FX888",
            "location": "Electronics Workshop Bench B",
            "description": "Adjustable digital temperature-controlled 70W soldering station with thermal recovery, ESD-safe design, and interchangeable chisel tips.",
            "specifications": {"Power": "70W", "Temp Range": "50C - 480C", "Stability": "+/- 1C", "Safety": "ESD Safe"},
            "approval_required": False,
            "min_booking_minutes": 30,
            "max_booking_minutes": 240,
            "slot_minutes": 30,
            "image": "https://images.unsplash.com/photo-1563770660941-20978e870e26?w=800&auto=format&fit=crop&q=80"
        },

        # --- MANUFACTURING & 3D PRINTING ---
        {
            "name": "Bambu Lab X1-Carbon Combo High-Speed 3D Printer (AMS)",
            "category": "Manufacturing",
            "department": "ME",
            "type": ResourceType.EQUIPMENT,
            "quantity": 3,
            "unit_prefix": "BAMBU-X1C",
            "location": "Rapid Prototyping Lab Pod 2",
            "description": "CoreXY 500mm/s 3D printer with dual auto-bed leveling, carbon fiber rod gantry, AI spaghetti detection, and 4-color multi-material AMS unit.",
            "specifications": {"Speed": "500 mm/s", "Build Volume": "256 x 256 x 256 mm", "Nozzle Temp": "Up to 300C", "Materials": "PLA, ABS, PETG, TPU, Carbon Fiber PA/PC"},
            "approval_required": False,
            "min_booking_minutes": 60,
            "max_booking_minutes": 480,
            "slot_minutes": 60,
            "image": "https://images.unsplash.com/photo-1615915468538-0fbd857888ca?w=800&auto=format&fit=crop&q=80"
        },
        {
            "name": "Glowforge Pro 45W Desktop CNC Laser Cutter",
            "category": "Manufacturing",
            "department": "ME",
            "type": ResourceType.EQUIPMENT,
            "quantity": 2,
            "unit_prefix": "GLOWFORGE",
            "location": "Fabrication Workshop B4",
            "description": "Class 4 45W CO2 laser cutter and engraver with autofocus, onboard camera material positioning, and passthrough slot for large acrylic and wood sheet cutting.",
            "specifications": {"Laser Tube": "45W CO2", "Cutting Bed": "20 x 18 inches", "Precision": "1000 DPI", "Safety": "Air assist and internal cooling"},
            "approval_required": True,
            "min_booking_minutes": 30,
            "max_booking_minutes": 180,
            "slot_minutes": 30,
            "image": "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=800&auto=format&fit=crop&q=80"
        },

        # --- AUDIO / VISUAL ---
        {
            "name": "Shure SM7B Dynamic Cardioid Vocal Studio Mic Kit",
            "category": "Audio/Visual",
            "department": "MD",
            "type": ResourceType.EQUIPMENT,
            "quantity": 6,
            "unit_prefix": "SHURE-SM7B",
            "location": "Podcast & Broadcast Studio A",
            "description": "Legendary broadcast studio vocal dynamic microphone with smooth flat wide-range frequency response, air suspension shock isolation, and pop filter.",
            "specifications": {"Polar Pattern": "Cardioid", "Frequency Response": "50 Hz - 20 kHz", "Output Impedance": "150 Ohms", "Connector": "3-pin XLR"},
            "approval_required": False,
            "min_booking_minutes": 60,
            "max_booking_minutes": 240,
            "slot_minutes": 60,
            "image": "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=800&auto=format&fit=crop&q=80"
        },
        {
            "name": "Blackmagic ATEM Mini Extreme ISO Live Video Switcher",
            "category": "Audio/Visual",
            "department": "MD",
            "type": ResourceType.EQUIPMENT,
            "quantity": 2,
            "unit_prefix": "ATEM-EXTREME",
            "location": "Broadcast Control Booth 2",
            "description": "8-input HDMI live production switcher with hardware streaming engine, multi-view output, and 9-channel isolated video recording for live university events.",
            "specifications": {"HDMI Inputs": "8x 1080p60", "Outputs": "2x HDMI, 2x USB-C webcam out", "Audio": "Fairlight 12-channel audio mixer"},
            "approval_required": True,
            "min_booking_minutes": 60,
            "max_booking_minutes": 360,
            "slot_minutes": 60,
            "image": "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=800&auto=format&fit=crop&q=80"
        },

        # --- LABORATORIES ---
        {
            "name": "Zeiss Primostar 3 Binocular Phase-Contrast Microscope",
            "category": "Laboratories",
            "department": "PH",
            "type": ResourceType.EQUIPMENT,
            "quantity": 6,
            "unit_prefix": "ZEISS-P3",
            "location": "Bio-Sciences Research Bench 2",
            "description": "Professional biological microscope with Plan-Achromat 4x, 10x, 40x, and 100x oil immersion objectives, LED illumination, and digital camera port.",
            "specifications": {"Magnification": "40x - 1000x", "Objectives": "Plan-Achromat 4x/10x/40x/100x", "Light Source": "Full-spectrum white LED"},
            "approval_required": False,
            "min_booking_minutes": 60,
            "max_booking_minutes": 300,
            "slot_minutes": 60,
            "image": "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=800&auto=format&fit=crop&q=80"
        },
        {
            "name": "Wet Chemistry Synthesis Hoods & Clean Room",
            "category": "Laboratories",
            "department": "PH",
            "type": ResourceType.FACILITY,
            "quantity": 1,
            "capacity": 12,
            "unit_prefix": "CLEAN-CHEM",
            "location": "Chemistry Annex Block C, Ground Floor",
            "description": "Class 10,000 cleanroom with 6 dedicated ducted laminar flow fume hoods, vacuum manifold lines, inert gas lines, and specialized chemical waste disposal.",
            "specifications": {"Cleanliness": "ISO 7 / Class 10,000", "Fume Hoods": "6x Thermo Fisher 6ft Walk-in", "Gases": "N2, Ar, Compressed Air"},
            "approval_required": True,
            "min_booking_minutes": 60,
            "max_booking_minutes": 240,
            "slot_minutes": 60,
            "image": "https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=800&auto=format&fit=crop&q=80"
        },

        # --- CLASSROOMS & AUDITORIUMS ---
        {
            "name": "Collaborative Design Thinking Studio (Active Learning)",
            "category": "Classrooms",
            "department": "CS",
            "type": ResourceType.FACILITY,
            "quantity": 1,
            "capacity": 45,
            "unit_prefix": "STUDIO-DTS",
            "location": "Student Innovation Center Rm 215",
            "description": "Flexible active-learning layout with movable dry-erase tables, 6 wall-mounted breakout digital displays, wireless screen sharing, and acoustic treatment.",
            "specifications": {"Capacity": "45 seats", "Displays": "6x 65-inch Samsung 4K Touchscreens", "Board": "360-degree magnetic whiteboard walls"},
            "approval_required": False,
            "min_booking_minutes": 60,
            "max_booking_minutes": 240,
            "slot_minutes": 60,
            "image": "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&auto=format&fit=crop&q=80"
        },
        {
            "name": "VR/AR Immersive Simulation Classroom & Sandbox",
            "category": "Classrooms",
            "department": "CS",
            "type": ResourceType.FACILITY,
            "quantity": 1,
            "capacity": 20,
            "unit_prefix": "VR-SANDBOX",
            "location": "Virtual Worlds Lab Rm 301",
            "description": "Spacious grid-marked room equipped with 8 Meta Quest 3 and 4 Apple Vision Pro headsets, high-speed Wi-Fi 6E mesh, and spatial audio speakers.",
            "specifications": {"Capacity": "20 participants", "Headsets": "8x Meta Quest 3, 4x Apple Vision Pro", "Network": "Dedicated Wi-Fi 6E 10Gbps mesh"},
            "approval_required": True,
            "min_booking_minutes": 60,
            "max_booking_minutes": 180,
            "slot_minutes": 60,
            "image": "https://images.unsplash.com/photo-1592478411213-6153e4ebc07d?w=800&auto=format&fit=crop&q=80"
        },

        # --- SPORTS ---
        {
            "name": "Yonex Astrox 88D Pro Tournament Badminton Racquets (Set of 4)",
            "category": "Sports",
            "department": "MD",
            "type": ResourceType.EQUIPMENT,
            "quantity": 6,
            "unit_prefix": "YONEX-88D",
            "location": "Campus Sports Complex Equipment Counter",
            "description": "High-modulus carbon graphite head-heavy tournament racquets with Rotational Generator System and premium nylon flight shuttlecocks.",
            "specifications": {"Weight": "4U (83g)", "Flex": "Stiff", "Grip": "G5", "String": "Yonex BG65 Ti at 26 lbs"},
            "approval_required": False,
            "min_booking_minutes": 60,
            "max_booking_minutes": 120,
            "slot_minutes": 60,
            "image": "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&auto=format&fit=crop&q=80"
        },
        {
            "name": "Wilson Evolution Official Game Indoor Basketballs (Pack of 3)",
            "category": "Sports",
            "department": "MD",
            "type": ResourceType.EQUIPMENT,
            "quantity": 6,
            "unit_prefix": "WILSON-EVO",
            "location": "Gymnasium Equipment Cage",
            "description": "Official NCAA indoor composite leather game balls with patented Cushion Core carcass for superior soft grip and consistent bounce.",
            "specifications": {"Size": "Official Size 7 (29.5\")", "Channel Construction": "Pebbled Composite Leather", "Use": "Indoor hardwood court"},
            "approval_required": False,
            "min_booking_minutes": 60,
            "max_booking_minutes": 180,
            "slot_minutes": 60,
            "image": "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&auto=format&fit=crop&q=80"
        },
        {
            "name": "Olympic Standard Synthetic Tennis Court 1",
            "category": "Sports",
            "department": "MD",
            "type": ResourceType.FACILITY,
            "quantity": 1,
            "capacity": 4,
            "unit_prefix": "TENNIS-CT1",
            "location": "Outdoor Sports Pavilion North",
            "description": "Plexipave 8-layer cushioned all-weather acrylic tennis court with LED stadium floodlights for evening games and tournament net.",
            "specifications": {"Surface": "8-Layer Acrylic Plexipave", "Lighting": "1000 Lux LED Stadium Array", "Court Lines": "ITF Certified Dimensions"},
            "approval_required": False,
            "min_booking_minutes": 60,
            "max_booking_minutes": 120,
            "slot_minutes": 60,
            "image": "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800&auto=format&fit=crop&q=80"
        },
    ]

    added_count = 0
    unit_count = 0

    for item in catalog:
        cat = categories.get(item["category"])
        dept = departments.get(item["department"]) or default_dept

        if not cat:
            print(f"Skipping {item['name']}, category {item['category']} not found.")
            continue

        existing = db.query(Resource).filter_by(name=item["name"]).first()
        if existing:
            # Update specifications and image if missing
            existing.specifications = item["specifications"]
            existing.description = item["description"]
            existing.location = item["location"]
            existing.approval_required = item["approval_required"]
            db.commit()
            continue

        res = Resource(
            name=item["name"],
            description=item["description"],
            category_id=cat.id,
            department_id=dept.id,
            owner_id=owner.id,
            location=item["location"],
            resource_type=item["type"],
            quantity=item["quantity"],
            capacity=item.get("capacity"),
            status=ResourceStatus.AVAILABLE,
            condition_note="Brand new / Excellent operational state",
            specifications=item["specifications"],
            deposit_amount=0.00,
            approval_required=item["approval_required"],
            training_required=False,
            is_restricted=False,
            min_booking_minutes=item["min_booking_minutes"],
            max_booking_minutes=item["max_booking_minutes"],
            slot_minutes=item["slot_minutes"],
            advance_booking_days=14,
            popularity_count=12,
        )
        db.add(res)
        db.flush()

        # Add primary image
        img = ResourceImage(
            resource_id=res.id,
            url=item["image"],
            is_primary=True,
            sort_order=1
        )
        db.add(img)

        # Add units for EQUIPMENT or 1 unit for FACILITY
        units_to_create = item["quantity"] if item["type"] == ResourceType.EQUIPMENT else 1
        for i in range(1, units_to_create + 1):
            code = f"{item['unit_prefix']}-{i:02d}"
            unit = ResourceUnit(
                resource_id=res.id,
                unit_code=code,
                condition=UnitCondition.EXCELLENT,
                is_active=True
            )
            db.add(unit)
            unit_count += 1

        # Add resource rule
        rule = ResourceRule(
            resource_id=res.id,
            allowed_roles=[UserRole.STUDENT.value, UserRole.OWNER.value, UserRole.MANAGER.value, UserRole.ADMIN.value],
            requires_faculty_approval=item["approval_required"],
            usage_instructions=f"Please handle {item['name']} with care. Report any irregularities immediately via the Incidents portal."
        )
        db.add(rule)

        # Add standard operating hours (Mon-Sun 08:00 - 20:00)
        for day in range(7):
            avail = ResourceAvailability(
                resource_id=res.id,
                day_of_week=day,
                open_time=time(8, 0),
                close_time=time(20, 0),
            )
            db.add(avail)

        added_count += 1

    db.commit()
    print(f"Catalog Expansion Complete! Added {added_count} brand-new diverse resources across all 9 categories with {unit_count} serialized inventory units!")

if __name__ == "__main__":
    populate()
