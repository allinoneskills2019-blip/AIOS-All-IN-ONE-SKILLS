export interface SkillMockQuestion {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
}

export interface SkillFieldTestPack {
  skillCategory: string;
  practicalChecklist: string[];
  questions: SkillMockQuestion[];
}

const DEFAULT_CHECKLIST = [
  'Carries standard personal protective equipment (PPE) and safety gear',
  'Performs site inspection and quotes transparent labor estimate before work',
  'Follows BIS / Mumbai building safety and clean-up standards',
];

const SKILL_TEST_BANK: Record<string, SkillFieldTestPack> = {
  Electrician: {
    skillCategory: 'Electrician',
    practicalChecklist: [
      'Uses insulated tester, digital multimeter, and clamp meter accurately',
      'Identifies Phase, Neutral, and Earth lines and verifies RCCB/ELCB trip',
      'Performs neat DB dressing with proper ferrule & lug termination',
    ],
    questions: [
      {
        id: 'el-1',
        question: 'Which protective device trips immediately upon earth leakage current (30 mA) to prevent electric shock?',
        options: ['MCB Type B', 'RCCB / ELCB', 'Isolator Switch', 'Surge Arrester'],
        correctIndex: 1,
      },
      {
        id: 'el-2',
        question: 'What is the standard copper wire gauge commonly used for a 16A power socket / 1.5 Ton AC circuit in residential wiring?',
        options: ['1.0 sq.mm', '1.5 sq.mm', '2.5 sq.mm or 4.0 sq.mm', '0.75 sq.mm'],
        correctIndex: 2,
      },
      {
        id: 'el-3',
        question: 'In a healthy single-phase 230V AC supply, what should the ideal voltage between Neutral and Earth be?',
        options: ['230V', '110V', 'Below 2V (near 0V)', '415V'],
        correctIndex: 2,
      },
      {
        id: 'el-4',
        question: 'Before working on a residential distribution board (DB), what is the mandatory first step?',
        options: [
          'Isolate main supply and verify zero voltage with a calibrated tester/multimeter',
          'Wear cotton gloves only',
          'Short Neutral and Earth together',
          'Remove the energy meter seal',
        ],
        correctIndex: 0,
      },
      {
        id: 'el-5',
        question: 'What is the standard phase-to-phase voltage of a three-phase supply in Mumbai?',
        options: ['230V', '400V – 415V', '110V', '660V'],
        correctIndex: 1,
      },
    ],
  },
  Plumber: {
    skillCategory: 'Plumber',
    practicalChecklist: [
      'Pressure-tests concealed CPVC/UPVC joints before wall plastering',
      'Checks P-trap / Nahani trap water seal to prevent sewer odor',
      'Installs pressure-reducing valves and non-return valves properly',
    ],
    questions: [
      {
        id: 'pl-1',
        question: 'Which pipe material is standard for hot and cold concealed domestic water supply lines?',
        options: ['Schedule 40 PVC', 'CPVC (SDR 11 / SDR 13.5)', 'SWR Grey Pipe', 'HDPE Agricultural Pipe'],
        correctIndex: 1,
      },
      {
        id: 'pl-2',
        question: 'What is the primary purpose of a water seal in a floor trap (Nahani trap) or P-trap?',
        options: [
          'Increase water pressure',
          'Block foul sewer gases from entering the room',
          'Filter dissolved salts',
          'Reduce hot water temperature',
        ],
        correctIndex: 1,
      },
      {
        id: 'pl-3',
        question: 'When applying solvent cement on CPVC pipes, what must be done before joining?',
        options: [
          'Heat the pipe over open flame',
          'Chamfer, clean dry, apply primer/cement evenly and hold for 15–30 seconds',
          'Apply Teflon tape on the plain socket',
          'Submerge joints in water immediately',
        ],
        correctIndex: 1,
      },
      {
        id: 'pl-4',
        question: 'Before concealing bathroom plumbing lines inside masonry, what hydraulic test pressure is typically checked?',
        options: ['0.5 kg/cm² for 5 mins', 'At least 6–10 kg/cm² (pressure test) without drop', 'No test required', 'Only gravity flow test'],
        correctIndex: 1,
      },
      {
        id: 'pl-5',
        question: 'Which valve prevents backflow of overhead tank or municipal water?',
        options: ['Gate Valve', 'Ball Valve', 'Non-Return Valve (Check Valve)', 'Angle Cock'],
        correctIndex: 2,
      },
    ],
  },
  'AC Technician': {
    skillCategory: 'AC Technician',
    practicalChecklist: [
      'Performs nitrogen pressure leak test and deep vacuuming (<500 microns) before charging',
      'Checks compressor amp draw, suction/discharge pressure, and delta-T',
      'Uses proper flare nuts, torque, and drain slope alignment',
    ],
    questions: [
      {
        id: 'ac-1',
        question: 'Why must an AC refrigeration circuit be vacuumed before charging R32 or R410A refrigerant?',
        options: [
          'To warm up the compressor oil',
          'To remove air and moisture that cause acid formation and poor cooling',
          'To increase fan RPM',
          'To clean the indoor air filter',
        ],
        correctIndex: 1,
      },
      {
        id: 'ac-2',
        question: 'Which gas is commonly used to pressure-test split AC copper lines for leaks safely?',
        options: ['Oxygen', 'Dry Nitrogen', 'Compressed Air', 'LPG'],
        correctIndex: 1,
      },
      {
        id: 'ac-3',
        question: 'For a healthy 1.5 Ton inverter split AC, what is the typical temperature drop (Delta-T) between return and supply air?',
        options: ['2°C – 3°C', '8°C – 12°C', '25°C – 30°C', '0°C'],
        correctIndex: 1,
      },
      {
        id: 'ac-4',
        question: 'Which refrigerant is mildly flammable (A2L) and requires extra safety care against sparks?',
        options: ['R22', 'R134a', 'R32', 'R407C'],
        correctIndex: 2,
      },
      {
        id: 'ac-5',
        question: 'Ice formation on the indoor evaporator coil during cooling mode most commonly indicates:',
        options: [
          'Excessive room humidity only',
          'Restricted airflow (dirty filter/blower) or low refrigerant charge',
          'High voltage stabilizer output',
          'Blocked outdoor drain pipe',
        ],
        correctIndex: 1,
      },
    ],
  },
  Carpenter: {
    skillCategory: 'Carpenter',
    practicalChecklist: [
      'Checks plumb, spirit level, and 90-degree squareness on carcasses & door frames',
      'Selects BWP Marine Ply for kitchen/bathroom wet areas in Mumbai humidity',
      'Applies edge banding, soft-close hinge alignment, and anti-termite treatment',
    ],
    questions: [
      {
        id: 'cp-1',
        question: 'Which grade of plywood (IS:710) is recommended for Mumbai kitchen sink cabinets and wet areas?',
        options: ['MR (Moisture Resistant) Grade', 'BWP (Boiling Water Proof / Marine) Grade', 'Particle Board', 'Softwood Blockboard'],
        correctIndex: 1,
      },
      {
        id: 'cp-2',
        question: 'Which standard concealed hinge opening angle is used for standard flush wardrobe shutters?',
        options: ['45 degrees', '95–110 degrees', '180 degrees', '270 degrees'],
        correctIndex: 1,
      },
      {
        id: 'cp-3',
        question: 'What tool ensures door frames and tall wardrobe units are vertically straight?',
        options: ['Plumb bob / Spirit level', 'Wood rasp', 'Coping saw', 'C-clamp'],
        correctIndex: 0,
      },
      {
        id: 'cp-4',
        question: 'What is the standard thickness of commercial plywood used for wardrobe main carcass panels?',
        options: ['6 mm', '12 mm', '18 mm / 19 mm', '3 mm'],
        correctIndex: 2,
      },
      {
        id: 'cp-5',
        question: 'Before pasting 1mm laminate onto plywood with contact adhesive, both surfaces should be:',
        options: [
          'Soaked with water',
          'Clean, dust-free, and tack-dried until touch-dry before pressing',
          'Oiled with linseed oil',
          'Sanded only on the glossy side of the laminate',
        ],
        correctIndex: 1,
      },
    ],
  },
  Painter: {
    skillCategory: 'Painter',
    practicalChecklist: [
      'Checks wall moisture/efflorescence before putty & waterproof primer',
      'Uses sanding grit progression (180 -> 320 -> 400) for smooth finish',
      'Applies proper primer + 2 finish coats with recommended drying intervals',
    ],
    questions: [
      {
        id: 'pt-1',
        question: 'In Mumbai monsoon-exposed exterior walls, what should be applied before topcoat emulsion?',
        options: [
          'Interior distemper',
          'Elastomeric exterior waterproof primer/basecoat after crack filling',
          'Chalk powder paste',
          'Varnish',
        ],
        correctIndex: 1,
      },
      {
        id: 'pt-2',
        question: 'Why is wall putty applied in thin layers (max ~1.5 mm total) rather than one thick coat?',
        options: [
          'To make the wall darker',
          'Thick putty cracks, peels, and reduces paint adhesion',
          'Putty dries faster in thick layers',
          'To skip primer application',
        ],
        correctIndex: 1,
      },
      {
        id: 'pt-3',
        question: 'What grit sandpaper is typically used for final smooth sanding of dried wall putty before primer?',
        options: ['40 grit', '80 grit', '320 – 400 grit', '24 grit'],
        correctIndex: 2,
      },
      {
        id: 'pt-4',
        question: 'Which primer is required on bare mild steel grills before applying synthetic enamel paint?',
        options: ['Cement primer', 'Red Oxide / Zinc Chromate metal primer', 'Wood sealer', 'Wall putty'],
        correctIndex: 1,
      },
      {
        id: 'pt-5',
        question: 'What is the minimum recommended drying gap between two coats of interior acrylic emulsion?',
        options: ['10 minutes', '4 – 6 hours', '7 days', 'No drying gap needed'],
        correctIndex: 1,
      },
    ],
  },
  Welder: {
    skillCategory: 'Welder',
    practicalChecklist: [
      'Uses auto-darkening welding helmet, leather apron, and welding gloves',
      'Sets correct amperage for plate thickness and cleans slag cleanly',
      'Checks weld penetration, undercut, and structural alignment',
    ],
    questions: [
      {
        id: 'wl-1',
        question: 'Which safety shade lens is standard for manual arc (SMAW) welding?',
        options: ['Clear safety glasses', 'Shade 10 – 12 welding filter lens', 'Shade 2 sunglasses', 'No lens needed'],
        correctIndex: 1,
      },
      {
        id: 'wl-2',
        question: 'In E6013 mild steel SMAW electrodes, what does the "60" stand for?',
        options: ['60 Amps current', '60,000 PSI minimum tensile strength', '60 mm length', '60 degrees angle'],
        correctIndex: 1,
      },
      {
        id: 'wl-3',
        question: 'If welding current (amperage) is set too high for thin MS sheet, what defect commonly occurs?',
        options: ['Cold lap', 'Burn-through and excessive spatter', 'Insufficient fusion', 'Zero arc strike'],
        correctIndex: 1,
      },
      {
        id: 'wl-4',
        question: 'Why must welding slag be chipped off completely between multi-pass welds?',
        options: [
          'To make the weld shinier only',
          'To prevent slag inclusion defects and weak weld joints',
          'To cool the metal faster',
          'To save electricity',
        ],
        correctIndex: 1,
      },
      {
        id: 'wl-5',
        question: 'Which gas is commonly used as shielding gas for Stainless Steel TIG (GTAW) welding?',
        options: ['Oxygen', 'Pure Argon', 'Acetylene', 'Compressed Air'],
        correctIndex: 1,
      },
    ],
  },
  Mason: {
    skillCategory: 'Mason',
    practicalChecklist: [
      'Checks plumb bob, right-angle (90°), and water-tube level across courses',
      'Maintains consistent mortar ratio, joint thickness (10–12 mm), and curing',
      'Wets bricks/AAC blocks appropriately before laying',
    ],
    questions: [
      {
        id: 'ms-1',
        question: 'What is the standard nominal mortar ratio commonly used for 230mm brick masonry walls?',
        options: ['1:1 (Cement:Sand)', '1:6 or 1:5 (Cement:Sand)', '1:15 (Cement:Sand)', 'Neat cement only'],
        correctIndex: 1,
      },
      {
        id: 'ms-2',
        question: 'When laying AAC blocks, what jointing material is recommended instead of thick sand-cement mortar?',
        options: ['Pure lime paste', 'Polymer-modified thin-bed AAC block adhesive (3–4 mm)', 'Gypsum board tape', 'Bitumen'],
        correctIndex: 1,
      },
      {
        id: 'ms-3',
        question: 'Minimum recommended water curing period for newly plastered or concrete surfaces is:',
        options: ['6 hours', '1 day', '7 – 10 days', 'No curing needed'],
        correctIndex: 2,
      },
      {
        id: 'ms-4',
        question: 'Which instrument checks whether two distant points on a floor or sill are at the exact same horizontal elevation?',
        options: ['Spirit level / Water-tube level', 'Trowel', 'Chisel', 'Float'],
        correctIndex: 0,
      },
      {
        id: 'ms-5',
        question: 'Before laying vitrified floor tiles over cement screed, what ensures zero hollow spots?',
        options: [
          'Spot-dabbing adhesive only at corners',
          'Full-bed notched trowel adhesive/cement slurry spread evenly',
          'Dry sand bed only',
          'Skipping surface cleaning',
        ],
        correctIndex: 1,
      },
    ],
  },
  'Civil Worker': {
    skillCategory: 'Civil Worker',
    practicalChecklist: [
      'Follows formwork shoring, bar-bending spacing, and concrete cover blocks',
      'Monitors concrete slump, vibrator compaction, and curing schedules',
      'Follows site helmet, harness, and excavation safety rules',
    ],
    questions: [
      {
        id: 'cw-1',
        question: 'What is the standard M20 nominal concrete mix ratio (Cement : Sand : Coarse Aggregate)?',
        options: ['1 : 1.5 : 3', '1 : 2 : 4', '1 : 3 : 6', '1 : 4 : 8'],
        correctIndex: 0,
      },
      {
        id: 'cw-2',
        question: 'Why are PVC or mortar cover blocks placed beneath reinforcement bars before concreting?',
        options: [
          'To make rebar look neat',
          'To maintain required concrete cover and protect steel from corrosion',
          'To reduce cement quantity',
          'To speed up formwork removal',
        ],
        correctIndex: 1,
      },
      {
        id: 'cw-3',
        question: 'What is the purpose of using a needle vibrator during slab or column concreting?',
        options: [
          'To dry concrete faster',
          'To expel entrapped air voids and prevent honeycombing',
          'To mix dry sand on site',
          'To cut steel bars',
        ],
        correctIndex: 1,
      },
      {
        id: 'cw-4',
        question: 'Which personal safety equipment is mandatory when working on scaffolding above 1.8 meters?',
        options: ['Safety helmet and full-body safety harness anchored securely', 'Cotton cap only', 'Flip-flops', 'None'],
        correctIndex: 0,
      },
      {
        id: 'cw-5',
        question: 'Once mixed with water, Ordinary Portland Cement concrete should generally be placed within:',
        options: ['30 – 45 minutes (before initial setting)', '6 hours', '24 hours', '3 days'],
        correctIndex: 0,
      },
    ],
  },
  'CCTV Technician': {
    skillCategory: 'CCTV Technician',
    practicalChecklist: [
      'Crimps RJ45 / BNC connectors cleanly with zero crosstalk or loose shields',
      'Configures NVR/DVR recording retention, motion zones, and mobile viewing',
      'Checks PoE budget, IR night-vision glare, and waterproof junction boxes',
    ],
    questions: [
      {
        id: 'cc-1',
        question: 'What is the standard wiring color standard (T568B) pin-1 & pin-2 pair on Cat6 Ethernet for IP cameras?',
        options: ['Blue / White-Blue', 'White-Orange / Orange', 'Brown / White-Brown', 'White-Green / Brown'],
        correctIndex: 1,
      },
      {
        id: 'cc-2',
        question: 'What maximum cable run distance is recommended for standard 100Mbps/Gigabit PoE over Cat6 without a repeater?',
        options: ['25 meters', '100 meters', '500 meters', '1000 meters'],
        correctIndex: 1,
      },
      {
        id: 'cc-3',
        question: 'Which storage drive type is specifically engineered for 24x7 continuous CCTV NVR/DVR recording?',
        options: ['Standard laptop HDD', 'Surveillance-grade HDD (e.g. Purple / SkyHawk)', 'USB flash drive', 'SD card only'],
        correctIndex: 1,
      },
      {
        id: 'cc-4',
        question: 'Which power supply is typically used for standard analog HD (TVI/CVI/AHD) dome/bullet cameras?',
        options: ['230V AC direct', '12V DC regulated SMPS', '48V AC', '5V USB'],
        correctIndex: 1,
      },
      {
        id: 'cc-5',
        question: 'What causes bright white circular glare on night-vision dome CCTV footage?',
        options: [
          'High internet speed',
          'IR reflection inside the glass dome from misaligned foam ring or dirt',
          'Too much HDD space',
          'Using Cat6 instead of Cat5e',
        ],
        correctIndex: 1,
      },
    ],
  },
  'RO Technician': {
    skillCategory: 'RO Technician',
    practicalChecklist: [
      'Tests raw and purified water TDS and pH using calibrated meters',
      'Flushes new sediment/carbon filters and sanitizes storage tank',
      'Checks booster pump pressure (70–85 PSI) and auto-flush / float switch',
    ],
    questions: [
      {
        id: 'ro-1',
        question: 'What does a TDS meter measure in drinking water?',
        options: [
          'Bacteria count only',
          'Total Dissolved Solids in ppm / mg/L',
          'Water temperature',
          'Water flow rate',
        ],
        correctIndex: 1,
      },
      {
        id: 'ro-2',
        question: 'Which stage removes chlorine and odor BEFORE water reaches the RO membrane to protect it?',
        options: ['Post-carbon filter', 'Activated Pre-Carbon filter', 'UV lamp', 'TDS controller'],
        correctIndex: 1,
      },
      {
        id: 'ro-3',
        question: 'If reject water flow stops completely while the booster pump is running, what happens to the RO membrane?',
        options: [
          'It cleans itself faster',
          'It chokes rapidly due to scaling and membrane fouling',
          'TDS drops to zero permanently',
          'Nothing happens',
        ],
        correctIndex: 1,
      },
      {
        id: 'ro-4',
        question: 'What is the typical operating pressure produced by a domestic RO booster pump?',
        options: ['5 – 10 PSI', '70 – 90 PSI', '500 PSI', '1 PSI'],
        correctIndex: 1,
      },
      {
        id: 'ro-5',
        question: 'What is the primary role of the UV chamber in a RO+UV purifier?',
        options: [
          'Lower water TDS',
          'Deactivate bacteria and viruses using ultraviolet light',
          'Add calcium minerals',
          'Increase tank capacity',
        ],
        correctIndex: 1,
      },
    ],
  },
  'Appliance Repair': {
    skillCategory: 'Appliance Repair',
    practicalChecklist: [
      'Uses clamp meter, continuity tester, and insulation megger safely',
      'Tests capacitors, heating elements, thermistors, and PCB relays accurately',
      'Demonstrates safe appliance grounding and post-repair leak/spin check',
    ],
    questions: [
      {
        id: 'ap-1',
        question: 'In a washing machine that fills with water but refuses to spin or drain, what should be checked first?',
        options: [
          'Power cord color',
          'Drain pump / clogged coin trap filter and lid/door lock switch',
          'Outer cabinet paint',
          'Water tap brand',
        ],
        correctIndex: 1,
      },
      {
        id: 'ap-2',
        question: 'When testing a microwave oven high-voltage capacitor safely, what is mandatory after unplugging?',
        options: [
          'Touch terminals directly with fingers',
          'Discharge the HV capacitor safely with an insulated resistor/screwdriver before probing',
          'Run the magnetron open',
          'Pour water on the PCB',
        ],
        correctIndex: 1,
      },
      {
        id: 'ap-3',
        question: 'In a frost-free refrigerator where the freezer is cold but the fresh-food section is warm, the likely fault is:',
        options: [
          'Broken door handle',
          'Defrost heater / bimetal thermostat / evaporator fan failure causing frost blockage',
          'Burnt interior LED light',
          'Loose power plug',
        ],
        correctIndex: 1,
      },
      {
        id: 'ap-4',
        question: 'How should a heating element in an electric geyser be checked for earth leakage?',
        options: [
          'By visual shine only',
          'Insulation resistance test between heating terminal and metallic body/earth',
          'Increasing thermostat dial',
          'Removing the safety valve',
        ],
        correctIndex: 1,
      },
      {
        id: 'ap-5',
        question: 'What tool measures AC motor running current without cutting the live wire?',
        options: ['Vernier caliper', 'Clamp-on Ammeter', 'Manometer', 'Spirit level'],
        correctIndex: 1,
      },
    ],
  },
  'Cleaning Services': {
    skillCategory: 'Cleaning Services',
    practicalChecklist: [
      'Selects pH-appropriate cleaners for marble, granite, glass, and stainless steel',
      'Uses color-coded microfiber cloths to prevent cross-contamination',
      'Wears chemical-resistant gloves, mask, and non-slip footwear',
    ],
    questions: [
      {
        id: 'cl-1',
        question: 'Why should strong acidic cleaners NEVER be used on Italian marble flooring?',
        options: [
          'They make marble slippery only',
          'Acid etches calcium carbonate in marble, permanently dulling and pitting the surface',
          'They turn marble blue',
          'They evaporate too slowly',
        ],
        correctIndex: 1,
      },
      {
        id: 'cl-2',
        question: 'Why should bleach (sodium hypochlorite) NEVER be mixed with acidic toilet cleaners or ammonia?',
        options: [
          'It reduces foam',
          'It releases toxic chlorine/chloramine gas',
          'It freezes the solution',
          'It stains plastic buckets white',
        ],
        correctIndex: 1,
      },
      {
        id: 'cl-3',
        question: 'In professional deep cleaning, what does color-coding microfiber cloths prevent?',
        options: [
          'Color fading in sunlight',
          'Cross-contamination between washrooms, kitchen counters, and living areas',
          'Static electricity only',
          'Fabric tearing',
        ],
        correctIndex: 1,
      },
      {
        id: 'cl-4',
        question: 'When vacuuming fine renovation gypsum/cement dust, what filter protection is required?',
        options: ['Wet sponge only', 'HEPA / fine dust filter bag to protect motor and air quality', 'No filter', 'Paper towel'],
        correctIndex: 1,
      },
      {
        id: 'cl-5',
        question: 'For deep sofa/upholstery sanitization, what sequence produces the best result?',
        options: [
          'Pour hot water directly without extraction',
          'Dry vacuum -> spot pre-treatment -> foam/injection extraction -> thorough drying',
          'Use bleach spray only',
          'Scrub with wire brush',
        ],
        correctIndex: 1,
      },
    ],
  },
  'Computer Repairing': {
    skillCategory: 'Computer Repairing',
    practicalChecklist: [
      'Uses ESD wrist strap / anti-static mat when handling motherboard, RAM, and CPU',
      'Checks SMPS/adapter voltage rails and thermal paste before replacing boards',
      'Backs up customer data or confirms consent before OS/drive servicing',
    ],
    questions: [
      {
        id: 'cr-1',
        question: 'When a desktop PC powers on (fans spin) with no display and continuous short RAM beeps, what is the first diagnostic step?',
        options: [
          'Format the SSD immediately',
          'Power off, disconnect AC, reseat/clean RAM sticks with contact cleaner or eraser, and test one slot at a time',
          'Replace the monitor HDMI cable only',
          'Overclock the CPU in BIOS',
        ],
        correctIndex: 1,
      },
      {
        id: 'cr-2',
        question: 'What tool/precaution prevents electrostatic discharge (ESD) damage while repairing laptops or motherboards?',
        options: [
          'Working on a synthetic wool carpet',
          'Grounded ESD wrist strap and disconnecting internal battery + AC adapter first',
          'Using a magnetized screwdriver on BIOS chips',
          'Touching CPU pins directly',
        ],
        correctIndex: 1,
      },
      {
        id: 'cr-3',
        question: 'If a laptop overheats above 95°C and shuts down under load, which service fixes the root cause?',
        options: [
          'Installing a screensaver',
          'Cleaning dust from cooling fins/fan and re-applying quality thermal paste on CPU/GPU die',
          'Decreasing screen brightness',
          'Replacing the keyboard',
        ],
        correctIndex: 1,
      },
      {
        id: 'cr-4',
        question: 'Which symptom commonly indicates a failing mechanical HDD or corrupted boot sector?',
        options: [
          'Clicking noise and SMART bad-sector / Boot Device Not Found errors',
          'Wi-Fi icon showing 5 bars',
          'Bright IPS display colors',
          'USB mouse LED glowing',
        ],
        correctIndex: 0,
      },
      {
        id: 'cr-5',
        question: 'Before handing over a repaired computer, what should the technician demonstrate to the customer?',
        options: [
          'Unplug the power cord without booting',
          'Full POST/boot check, display/audio/ports test, temperature stability, and intact user files',
          'Delete BIOS password without permission',
          'Leave screws loose on bottom panel',
        ],
        correctIndex: 1,
      },
    ],
  },
  Software: {
    skillCategory: 'Software',
    practicalChecklist: [
      'Backs up customer documents/desktop before OS reinstallation or partition changes',
      'Installs genuine / licensed OS builds and verified OEM chipset/GPU drivers',
      'Verifies Windows/Linux updates, firewall, and malware scan before handover',
    ],
    questions: [
      {
        id: 'sw-1',
        question: 'Before performing a clean OS installation on a customer PC, what must always be verified first?',
        options: [
          'Delete all partitions immediately',
          'Verify whether user data backup is needed and confirm target partition',
          'Disable the cooling fan',
          'Flash an incompatible BIOS',
        ],
        correctIndex: 1,
      },
      {
        id: 'sw-2',
        question: 'When a system displays missing display resolution or missing Wi-Fi after OS setup, what is the cleanest fix?',
        options: [
          'Reformat the hard drive',
          'Install official OEM chipset, graphics, and wireless drivers matching the hardware ID',
          'Disable Device Manager completely',
          'Replace the motherboard',
        ],
        correctIndex: 1,
      },
      {
        id: 'sw-3',
        question: 'Which boot mode & partition scheme combination is required for modern UEFI systems with drives larger than 2 TB?',
        options: ['Legacy MBR', 'UEFI with GPT partition style', 'FAT16 only', 'IDE emulation'],
        correctIndex: 1,
      },
      {
        id: 'sw-4',
        question: 'What is the safest way to troubleshoot a startup crash or BSOD loop without losing installed software?',
        options: [
          'Boot into Safe Mode / Windows Recovery Environment to inspect recent driver updates or run SFC/DISM',
          'Unplug RAM while powered on',
          'Delete System32 folder',
          'Format C: drive immediately',
        ],
        correctIndex: 0,
      },
      {
        id: 'sw-5',
        question: 'How should a technician handle software licensing during client installation?',
        options: [
          'Use unauthorized cracks/activators that introduce malware',
          'Use genuine customer product keys, OEM digital licenses, or approved open-source software',
          'Share another customer private corporate key',
          'Turn off Windows Defender permanently',
        ],
        correctIndex: 1,
      },
    ],
  },
  Hardware: {
    skillCategory: 'Hardware',
    practicalChecklist: [
      'Verifies socket, chipset, RAM generation (DDR4/DDR5), and PSU wattage compatibility',
      'Tests SMPS rails, CMOS battery, NVMe/SATA storage health, and cable routing',
      'Secures standoffs, GPU brackets, and airflow direction cleanly',
    ],
    questions: [
      {
        id: 'hw-1',
        question: 'Can a DDR4 RAM module be installed into a DDR5 motherboard slot?',
        options: [
          'Yes, with extra force',
          'No — notch key position, pinout, and voltage specs are physically and electrically incompatible',
          'Yes, after a BIOS update',
          'Only in dual-channel mode',
        ],
        correctIndex: 1,
      },
      {
        id: 'hw-2',
        question: 'What happens if brass motherboard standoffs are missing or placed in the wrong hole inside a metal cabinet?',
        options: [
          'Faster SSD speed',
          'Motherboard solder traces can short-circuit to the chassis and prevent boot or cause damage',
          'Lower CPU temperature',
          'Extra USB bandwidth',
        ],
        correctIndex: 1,
      },
      {
        id: 'hw-3',
        question: 'Which interface delivers the highest sequential read/write speeds for modern boot SSDs?',
        options: ['SATA II (3 Gbps)', 'PCIe NVMe M.2 SSD', 'IDE / PATA ribbon', 'USB 2.0 flash'],
        correctIndex: 1,
      },
      {
        id: 'hw-4',
        question: 'When upgrading a workstation with a high-power GPU, which component capacity and rail rating must be verified?',
        options: [
          'Optical DVD drive speed',
          'SMPS (PSU) total wattage, 80+ efficiency, +12V rail amperage, and PCIe power connectors',
          'CMOS battery brand',
          'SATA cable color',
        ],
        correctIndex: 1,
      },
      {
        id: 'hw-5',
        question: 'Which hardware symptom points to a depleted CR2032 CMOS battery on a motherboard?',
        options: [
          'System date/time resets on every AC power disconnect and BIOS settings revert to defaults',
          'Monitor brightness flickers only in games',
          'Printer out of paper',
          'Ethernet cable turns red',
        ],
        correctIndex: 0,
      },
    ],
  },
  Networking: {
    skillCategory: 'Networking',
    practicalChecklist: [
      'Uses RJ45 crimper, punch-down tool, and LAN cable continuity tester for all drops',
      'Follows T568A/T568B color standard consistently and avoids sharp bend radius on Cat6/fiber',
      'Verifies DHCP/static IP, gateway, DNS, and Wi-Fi channel/security (WPA2/WPA3)',
    ],
    questions: [
      {
        id: 'nw-1',
        question: 'Which wiring standard pairs pins 1–2 (Orange/White-Orange) and pins 3–6 (Green/White-Green) on most commercial Cat6 RJ45 terminations?',
        options: ['RS-232', 'TIA/EIA-568B (T568B)', 'Coaxial RG-6', 'Token Ring'],
        correctIndex: 1,
      },
      {
        id: 'nw-2',
        question: 'What is the maximum recommended horizontal channel length for a standard Cat6 Ethernet copper run before signal attenuation exceeds spec?',
        options: ['15 meters', '100 meters (including patch cords)', '500 meters', '1,000 meters'],
        correctIndex: 1,
      },
      {
        id: 'nw-3',
        question: 'If a client PC shows an IP address of 169.254.x.x (APIPA), what does it indicate?',
        options: [
          'Gigabit fiber link is optimal',
          'The device failed to receive a valid IP lease from the DHCP server/router',
          'Public static IP is assigned',
          'DNS cache is full',
        ],
        correctIndex: 1,
      },
      {
        id: 'nw-4',
        question: 'When deploying two routers in an office LAN to extend Ethernet and Wi-Fi without double NAT, how should the second router be configured?',
        options: [
          'Keep DHCP enabled on both routers with the same IP',
          'Configure as Access Point (AP) mode / disable secondary DHCP and connect via LAN port with unique LAN IP',
          'Short pins 4 and 5 together',
          'Use WEP open security',
        ],
        correctIndex: 1,
      },
      {
        id: 'nw-5',
        question: 'Which security protocol should be configured on modern office and home Wi-Fi access points?',
        options: ['WEP 64-bit', 'Open unencrypted SSID', 'WPA2-AES or WPA3-Personal', 'MAC filtering only without encryption'],
        correctIndex: 2,
      },
    ],
  },
  'Network Technician': {
    skillCategory: 'Network Technician',
    practicalChecklist: [
      'Terminates Cat6/Cat6A keystone jacks and patch panels to T568B standard cleanly',
      'Uses tone generator, cable certifier/tester, and optical power meter safely',
      'Labels racks, VLAN ports, and PoE injector switches accurately',
    ],
    questions: [
      {
        id: 'nt-1',
        question: 'Which tool locates a specific unmarked Cat6 cable inside a busy building patch rack?',
        options: ['Clamp ammeter', 'Tone generator & inductive probe', 'Vernier caliper', 'Heat gun'],
        correctIndex: 1,
      },
      {
        id: 'nt-2',
        question: 'What PoE standard (IEEE 802.3at) delivers up to ~30W per port for PTZ cameras and Wi-Fi 6 APs?',
        options: ['Passive 12V', 'PoE+', 'Token Ring', 'RS-485'],
        correctIndex: 1,
      },
      {
        id: 'nt-3',
        question: 'Why should untwisted wire pairs inside an RJ45 plug or keystone jack be kept under 13 mm?',
        options: [
          'To save copper cost',
          'To minimize near-end crosstalk (NEXT) and packet loss at Gigabit speeds',
          'To make the plug heavier',
          'To increase DC voltage',
        ],
        correctIndex: 1,
      },
      {
        id: 'nt-4',
        question: 'When splicing or patching Single-Mode Fiber (OS2), what happens if the patch cord is bent tighter than minimum bend radius?',
        options: [
          'Speed doubles',
          'High optical attenuation / signal loss at the bend',
          'PoE voltage increases',
          'Nothing happens',
        ],
        correctIndex: 1,
      },
      {
        id: 'nt-5',
        question: 'Before handing over an office network rack, what test should be recorded per port?',
        options: [
          'Wiremap continuity, link negotiation speed (1G/10G), and labeled port diagram',
          'Only power outlet check',
          'Room paint color',
          'No documentation needed',
        ],
        correctIndex: 0,
      },
    ],
  },
  'IT Engineering': {
    skillCategory: 'IT Engineering',
    practicalChecklist: [
      'Follows backup verification, change control, and least-privilege access before server/workstation updates',
      'Audits UPS load, RAID array health, endpoint security, and network latency',
      'Documents IP schemas, credentials handoff, and recovery procedures cleanly',
    ],
    questions: [
      {
        id: 'it-1',
        question: 'In a small office RAID-1 (mirrored) server array, what happens if one of the two drives fails?',
        options: [
          'All data is permanently lost immediately',
          'The array continues running in degraded mode from the surviving drive until replaced and rebuilt',
          'RAM capacity doubles',
          'Network switches turn off',
        ],
        correctIndex: 1,
      },
      {
        id: 'it-2',
        question: 'What is the purpose of VLAN segmentation between guest Wi-Fi and internal office POS/servers?',
        options: [
          'Reduce Wi-Fi signal strength',
          'Isolate untrusted guest traffic from internal business assets',
          'Disable DNS resolution',
          'Eliminate routers completely',
        ],
        correctIndex: 1,
      },
      {
        id: 'it-3',
        question: 'What is the 3-2-1 backup principle for critical business workstations and servers?',
        options: [
          '3 copies of data, on 2 different media types, with 1 offsite/cloud copy',
          '3 folders on 1 desktop',
          'Back up only once every 2 years',
          'Store all backups on a single USB drive plugged into the same server',
        ],
        correctIndex: 0,
      },
      {
        id: 'it-4',
        question: 'Which command verifies round-trip latency and packet loss to a gateway or DNS server?',
        options: ['format', 'ping / traceroute', 'diskpart', 'chmod 777'],
        correctIndex: 1,
      },
      {
        id: 'it-5',
        question: 'Why must critical network racks and NAS servers connect via an Online Double-Conversion or AVR UPS?',
        options: [
          'To increase CPU clock speed',
          'To prevent silent file-system corruption and abrupt downtime during power sags/outages',
          'To replace Ethernet switches',
          'To cool the room',
        ],
        correctIndex: 1,
      },
    ],
  },
  'Automotive Services': {
    skillCategory: 'Automotive Services',
    practicalChecklist: [
      'Uses insulated high-voltage gloves/tools (1000V rated) when diagnosing EV battery/motor harnesses',
      'Connects OBD-II / EV BMS diagnostic scanners safely and logs fault DTC codes before clearing',
      'Checks torque specs, brake fluid/pad wear, coolant health, and tire pressure after service',
    ],
    questions: [
      {
        id: 'au-1',
        question: 'Before inspecting high-voltage orange cables on an Electric Two-Wheeler or EV Four-Wheeler, what is mandatory?',
        options: [
          'Touch busbars with bare hands',
          'Power off ignition, remove/isolate MSD/HV disconnect, wait for capacitor discharge, and wear 1000V insulated gloves',
          'Spray water on the traction battery',
          'Short positive and negative terminals',
        ],
        correctIndex: 1,
      },
      {
        id: 'au-2',
        question: 'What does an OBD-II / Four-Wheeler Diagnostic Scanner read through the 16-pin DLC port?',
        options: [
          'Only fuel tank cap tightness',
          'ECU live sensor PIDs, DTC trouble codes, ABS/airbag modules, and freeze-frame telemetry',
          'Tire rubber age',
          'Windshield wiper length',
        ],
        correctIndex: 1,
      },
      {
        id: 'au-3',
        question: 'In a petrol or diesel car engine, why should spark plugs / injectors NOT be serviced while the engine block is piping hot?',
        options: [
          'Fuel evaporates too slowly',
          'Thermal expansion risks stripping aluminum cylinder-head threads and scalding fuel/coolant burn',
          'Battery voltage rises to 48V',
          'Headlights dim',
        ],
        correctIndex: 1,
      },
      {
        id: 'au-4',
        question: 'What indicates cell imbalance or BMS thermal fault in an EV two-wheeler or four-wheeler battery pack?',
        options: [
          'Bright LED turn indicators',
          'Sudden State-of-Charge (SoC) drop under throttle, charging cutoff, and BMS voltage delta warnings',
          'Horn sounding louder',
          'Clean brake discs',
        ],
        correctIndex: 1,
      },
      {
        id: 'au-5',
        question: 'After replacing brake pads and bleeding hydraulic lines on a car or bike, what must be verified before road delivery?',
        options: [
          'Firm pedal/lever feel with zero sponginess, no caliper leaks, and torque-checked axle/lug bolts',
          'Leaving lug nuts hand-tight',
          'Skipping test braking',
          'Removing DOT brake fluid cap permanently',
        ],
        correctIndex: 0,
      },
    ],
  },
};

export function getSkillTestPack(skillCategory: string): SkillFieldTestPack {
  if (SKILL_TEST_BANK[skillCategory]) {
    return SKILL_TEST_BANK[skillCategory];
  }
  return {
    skillCategory: skillCategory || 'Other Skills',
    practicalChecklist: DEFAULT_CHECKLIST,
    questions: [
      {
        id: 'gen-1',
        question: 'Before starting any technical or site job at a customer location, what is the first step?',
        options: [
          'Start dismantling equipment immediately',
          'Inspect site safety, confirm job scope, and get customer approval on estimated charges',
          'Ask customer to leave the premises',
          'Switch off building main power without informing anyone',
        ],
        correctIndex: 1,
      },
      {
        id: 'gen-2',
        question: 'Which practice ensures safe and durable workmanship across all trades?',
        options: [
          'Using calibrated tools, proper PPE, and manufacturer-recommended materials',
          'Skipping testing after repair',
          'Using undersized spare parts',
          'Leaving loose debris and exposed wires',
        ],
        correctIndex: 0,
      },
      {
        id: 'gen-3',
        question: 'What should a technician do if an unexpected extra repair is discovered mid-job?',
        options: [
          'Charge double at the end without notice',
          'Show the issue clearly to the customer and confirm revised scope before proceeding',
          'Ignore the fault',
          'Use temporary tape without informing anyone',
        ],
        correctIndex: 1,
      },
      {
        id: 'gen-4',
        question: 'Why must post-work functional testing be demonstrated to the customer before closing a job?',
        options: [
          'To waste time on site',
          'To verify safe operation, quality assurance, and build customer trust',
          'Only required for commercial sites',
          'To delay payment',
        ],
        correctIndex: 1,
      },
      {
        id: 'gen-5',
        question: 'How should a technician keep their availability status in All in One Skill when already occupied on a site?',
        options: [
          'Leave status as Available and ignore calls',
          'Update status to Busy or Unavailable so new bookings are routed accurately',
          'Delete their profile',
          'Ask customers to book twice',
        ],
        correctIndex: 1,
      },
    ],
  };
}
