/**
 * @file Default Activities & Materials
 * @description All project activities (603B, 907, 916, 919, 922, 924, 934A, 1220, 1230, 1425A, 6723)
 * with their materials, rates, SAP item codes, and default SAP mappings.
 * This is the core business data that defines billing line items.
 * 
 * @global {Object} defaultActivities
 * @readonly
 * @since v1.0
 * @audit Lines changed: [date] — [reason]
 */

const defaultActivities = {
  "603B": {
    "title": "603B: Erection, Testing & Commissioning of 11kv Feeder Bay with Gantry Structure & PT",
    "materials": [
      {
        "no": "1",
        "desc": "L.As. 11 KV (Gapless type) with disconnector",
        "unit": "Set",
        "rate": 800.0,
        "itemCode": "17000128",
        "sapDescription": "LA 11 KV GAPLESS WITH DISCONNECTOR",
        "sapUom": "SET",
        "docHeader": "0031006106",
        "sapItems": [
          {
            "code": "17000128",
            "desc": "LA 11 KV GAPLESS WITH DISCONNECTOR",
            "uom": "SET",
            "docHeader": "0031006106"
          }
        ]
      },
      {
        "no": "2",
        "desc": "11 KV Isolators with EB (800 A)",
        "unit": "Set",
        "rate": 9000.0,
        "itemCode": "17001249",
        "sapDescription": "ISOLATOR 11 KV WITH EB 800 AMP",
        "sapUom": "SET",
        "docHeader": "0031007467",
        "sapItems": [
          {
            "code": "17001249",
            "desc": "ISOLATOR 11 KV WITH EB 800 AMP",
            "uom": "SET",
            "docHeader": "0031007467"
          }
        ]
      },
      {
        "no": "3",
        "desc": "11 KV Isolators without EB (800 Amp.)",
        "unit": "Set",
        "rate": 9000.0,
        "itemCode": "17001250",
        "sapDescription": "ISOLATOR 11 KV WITHOUT EB 800 AMP",
        "sapUom": "SET",
        "docHeader": "0031007467",
        "sapItems": [
          {
            "code": "17001250",
            "desc": "ISOLATOR 11 KV WITHOUT EB 800 AMP",
            "uom": "SET",
            "docHeader": "0031007467"
          }
        ]
      },
      {
        "no": "4",
        "desc": "11 KV VCB 400 A Outdoor",
        "unit": "Set",
        "rate": 9000.0,
        "itemCode": "17005100",
        "sapDescription": "CIRCUIT BREAKER 11 KV 400 AMP",
        "sapUom": "SET",
        "docHeader": "EE00009753",
        "sapItems": [
          {
            "code": "17005100",
            "desc": "CIRCUIT BREAKER 11 KV 400 AMP",
            "uom": "SET",
            "docHeader": "EE00009753"
          }
        ]
      },
      {
        "no": "5",
        "desc": "11 KV PT",
        "unit": "Set",
        "rate": 2000.0,
        "itemCode": "17005102",
        "sapDescription": "POTENTIAL TRANSFORMER 11KV/110V",
        "sapUom": "SET",
        "docHeader": "EE00009753",
        "sapItems": [
          {
            "code": "17005102",
            "desc": "POTENTIAL TRANSFORMER 11KV/110V",
            "uom": "SET",
            "docHeader": "EE00009753"
          }
        ]
      },
      {
        "no": "6",
        "desc": "11 KV CT 400 - 200 / 5 - 5 Outdoor",
        "unit": "No",
        "rate": 2333.34,
        "itemCode": "17005101",
        "sapDescription": "CURRENT TRANSFORMER 11KV 400-200/5-5",
        "sapUom": "NO",
        "docHeader": "EE00009753",
        "sapItems": [
          {
            "code": "17005101",
            "desc": "CURRENT TRANSFORMER 11KV 400-200/5-5",
            "uom": "NO",
            "docHeader": "EE00009753"
          }
        ]
      },
      {
        "no": "7",
        "desc": "C&R Panel for 11 kV Outgoing Feeder OD",
        "unit": "Nos.",
        "rate": 7000.0,
        "itemCode": "17000036",
        "sapDescription": "CRP FOR 11KV FEEDER BREAKER",
        "sapUom": "NOS",
        "docHeader": "0031007467",
        "sapItems": [
          {
            "code": "17000036",
            "desc": "CRP FOR 11KV FEEDER BREAKER",
            "uom": "NOS",
            "docHeader": "0031007467"
          }
        ]
      },
      {
        "no": "8",
        "desc": "Structure and foundation cables, clamps, painting etc. as per sheet (A+B+C+D+F)",
        "unit": "L.S.",
        "rate": 75000.0,
        "itemCode": "17004596",
        "sapDescription": "CABLE AL LT XLPE 1X120 SQMM ARM",
        "sapUom": "M",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17004596",
            "desc": "CABLE AL LT XLPE 1X120 SQMM ARM",
            "uom": "M",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "9",
        "desc": "Marshalling Box",
        "unit": "No",
        "rate": 900.0,
        "itemCode": "17004922",
        "sapDescription": "MARSHALLING BOX FOR 11 KV",
        "sapUom": "NO",
        "docHeader": "0031007467",
        "sapItems": [
          {
            "code": "17004922",
            "desc": "MARSHALLING BOX FOR 11 KV",
            "uom": "NO",
            "docHeader": "0031007467"
          }
        ]
      },
      {
        "no": "10",
        "desc": "Earthing as per Sheet (E) 11 KV Bay",
        "unit": "L.S.",
        "rate": 11300.0,
        "itemCode": "17001369",
        "sapDescription": "EARTHING SET LT",
        "sapUom": "NO",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17001369",
            "desc": "EARTHING SET LT",
            "uom": "NO",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "11",
        "desc": "MS Steel for RCC works etc",
        "unit": "Job",
        "rate": 7500.0,
        "itemCode": "17005082",
        "sapDescription": "MS-U CL FOR SHACKLE INS-50X6X342-0.807KG",
        "sapUom": "NO",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17005082",
            "desc": "MS-U CL FOR SHACKLE INS-50X6X342-0.807KG",
            "uom": "NO",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "12",
        "desc": "Metal Spreading 20 mm, 40 mm stone",
        "unit": "M3",
        "rate": 1000.0,
        "itemCode": "17005052",
        "sapDescription": "MS-HT STAY SET 20 MM",
        "sapUom": "SET",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17005052",
            "desc": "MS-HT STAY SET 20 MM",
            "uom": "SET",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "13",
        "desc": "Water arrangement if required",
        "unit": "Job",
        "rate": 1800.0,
        "itemCode": "22005498",
        "sapDescription": "DISTILLED WATER",
        "sapUom": "L",
        "docHeader": "MATETIAL USE CAMPER",
        "sapItems": [
          {
            "code": "22005498",
            "desc": "DISTILLED WATER",
            "uom": "L",
            "docHeader": "MATETIAL USE CAMPER"
          }
        ]
      },
      {
        "no": "14",
        "desc": "Miscellaneous materials for 11KV Bay i.e Gland, Lug, ferruler, PVC Pipe etc.",
        "unit": "JOB",
        "rate": 4300.0,
        "itemCode": "17000036",
        "sapDescription": "CRP FOR 11KV FEEDER BREAKER",
        "sapUom": "SET",
        "docHeader": "0031007467",
        "sapItems": [
          {
            "code": "17000036",
            "desc": "CRP FOR 11KV FEEDER BREAKER",
            "uom": "SET",
            "docHeader": "0031007467"
          }
        ]
      },
      {
        "no": "15",
        "desc": "11KV A.B. Swtch, 400 A",
        "unit": "Set",
        "rate": 1800.0,
        "isExtra": true
      },
      {
        "no": "16",
        "desc": "MS Channel Top Channel (100x50x6 mm)",
        "unit": "No",
        "rate": 125.0,
        "isExtra": true
      },
      {
        "no": "17",
        "desc": "M.S.Channel AB switch (75x40x6 mm)",
        "unit": "No",
        "rate": 125.0,
        "isExtra": true
      },
      {
        "no": "18",
        "desc": "H.T.Stay Set",
        "unit": "Set",
        "rate": 600.0,
        "isExtra": true
      },
      {
        "no": "19",
        "desc": "Strain Hardware forWeasel/Squirrel",
        "unit": "Set",
        "rate": 10.0,
        "isExtra": true
      },
      {
        "no": "20",
        "desc": "Disc Insulator 11 KV 70 KN",
        "unit": "No",
        "rate": 35.0,
        "isExtra": true
      },
      {
        "no": "21",
        "desc": "RSJ 116x100, 9 m long",
        "unit": "No",
        "rate": 2100.0,
        "isExtra": true
      },
      {
        "no": "22",
        "desc": "Concreting ration 1:3 6",
        "unit": "CMT",
        "rate": 2700.0,
        "isExtra": true
      }
    ]
  },
  "1230": {
    "title": "1230: Erection, Testing & Commissioning of 11 KV Specially Designed Transformer with all accessories, Control cable, Relays",
    "materials": [
      {
        "no": "1",
        "desc": "11 KV Specially Designed Transformer with all accessories, Control cable , Relays, contactors etc",
        "unit": "Set",
        "rate": 3000.0,
        "itemCode": "17000081",
        "sapDescription": "DIST BOX WITH KITKAT FOR 100 KVA DTC",
        "sapUom": "NO",
        "docHeader": "0031003360",
        "sapItems": [
          {
            "code": "17000081",
            "desc": "DIST BOX WITH KITKAT FOR 100 KVA DTC",
            "uom": "NO",
            "docHeader": "0031003360"
          }
        ]
      },
      {
        "no": "2",
        "desc": "11 KV Gang operated Three pole double Throw changeover switch",
        "unit": "Set",
        "rate": 2300.0,
        "itemCode": "17000004",
        "sapDescription": "RSJ POLE 100X116 MM 9 MTR",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000004",
            "desc": "RSJ POLE 100X116 MM 9 MTR",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "3",
        "desc": "11 KV DP fabrication complete set with L.A.",
        "unit": "Set",
        "rate": 3500.0,
        "itemCode": "17001249",
        "sapDescription": "ISOLATOR 11 KV WITH EB 800 AMP",
        "sapUom": "SET",
        "docHeader": "0031007467",
        "sapItems": [
          {
            "code": "17001249",
            "desc": "ISOLATOR 11 KV WITH EB 800 AMP",
            "uom": "SET",
            "docHeader": "0031007467"
          }
        ]
      },
      {
        "no": "4",
        "desc": "16 Sqmm Single core multistrand copper Armoured Cable",
        "unit": "Rmt.",
        "rate": 25.0,
        "itemCode": "17004596",
        "sapDescription": "CABLE AL LT XLPE 1X120 SQMM AR",
        "sapUom": "MTR",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17004596",
            "desc": "CABLE AL LT XLPE 1X120 SQMM AR",
            "uom": "MTR",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "5",
        "desc": "Relay Box MS fabricated with powder coating suitable for outdoor installation of Relay",
        "unit": "No.",
        "rate": 200.0,
        "itemCode": "17005107",
        "sapDescription": "RELAY BOX MS FABRICATED FOR SD",
        "sapUom": "NO",
        "docHeader": "0031007408",
        "sapItems": [
          {
            "code": "17005107",
            "desc": "RELAY BOX MS FABRICATED FOR SD",
            "uom": "NO",
            "docHeader": "0031007408"
          }
        ]
      },
      {
        "no": "6",
        "desc": "Concreting ratio 1:3:6",
        "unit": "CMT",
        "rate": 2700.0,
        "itemCode": "11000336",
        "sapDescription": "CEMENT GRADE OPC 53",
        "sapUom": "CMT",
        "docHeader": "0031003360",
        "sapItems": [
          {
            "code": "11000336",
            "desc": "CEMENT GRADE OPC 53",
            "uom": "CMT",
            "docHeader": "0031003360"
          }
        ]
      },
      {
        "no": "7",
        "desc": "CI Earthing 150mmDia & 3 Mtr Long",
        "unit": "No.",
        "rate": 3000.0,
        "itemCode": "17001369",
        "sapDescription": "EARTHING SET LT",
        "sapUom": "NO",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17001369",
            "desc": "EARTHING SET LT",
            "uom": "NO",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "8",
        "desc": "11 kV Pin Insulators with G.I. Pins",
        "unit": "No.",
        "rate": 15.0,
        "itemCode": "17001397",
        "sapDescription": "PIN INSULATOR WITH GI PIN 11KV 5KN",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17001397",
            "desc": "PIN INSULATOR WITH GI PIN 11KV 5KN",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "9",
        "desc": "Disc Insulator 11 KV 70 KN",
        "unit": "No.",
        "rate": 30.0,
        "itemCode": "17000046",
        "sapDescription": "DISC INSULATOR 11KV 70KN B & S POLY",
        "sapUom": "NO",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000046",
            "desc": "DISC INSULATOR 11KV 70KN B & S POLY",
            "uom": "NO",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "10",
        "desc": "Strain Hardware for 55 Sq.mm AAAC",
        "unit": "Set",
        "rate": 20.0,
        "itemCode": "17000702",
        "sapDescription": "STRAIN HARDWARE FOR ACSR DOG B&S TY",
        "sapUom": "SET",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000702",
            "desc": "STRAIN HARDWARE FOR ACSR DOG B&S TY",
            "uom": "SET",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "11",
        "desc": "AAAC 55 mm2",
        "unit": "Rmt",
        "rate": 4.0,
        "itemCode": "17005597",
        "sapDescription": "COVERED CONDUCTOR 55 SQMM",
        "sapUom": "MTR",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17005597",
            "desc": "COVERED CONDUCTOR 55 SQMM",
            "uom": "MTR",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "12",
        "desc": "Earthing Sets H.T",
        "unit": "Set",
        "rate": 170.0,
        "itemCode": "17001369",
        "sapDescription": "EARTHING SET LT",
        "sapUom": "SET",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17001369",
            "desc": "EARTHING SET LT",
            "uom": "SET",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "13",
        "desc": "2Core 2.5sqmm Copper Cable",
        "unit": "Rmt",
        "rate": 15.0,
        "itemCode": "17002274",
        "sapDescription": "COPPER FLEXIBLE WIRE 2.5 SQMM",
        "sapUom": "MTR",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17002274",
            "desc": "COPPER FLEXIBLE WIRE 2.5 SQMM",
            "uom": "MTR",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "14",
        "desc": "4 Core 2.5sqmm Copper Cable",
        "unit": "Rmt",
        "rate": 15.0,
        "itemCode": "17002274",
        "sapDescription": "COPPER FLEXIBLE WIRE 2.5 SQMM",
        "sapUom": "MTR",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17002274",
            "desc": "COPPER FLEXIBLE WIRE 2.5 SQMM",
            "uom": "MTR",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "15",
        "desc": "RSJ 116x100, 9 m long",
        "unit": "No.",
        "rate": 2100.0,
        "itemCode": "17000004",
        "sapDescription": "RSJ POLE 100X116 MM 9 MTR",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000004",
            "desc": "RSJ POLE 100X116 MM 9 MTR",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "16",
        "desc": "G.I.Wire 8 SWG / 6 SWG",
        "unit": "Kg.",
        "rate": 2.0,
        "itemCode": "17000243",
        "sapDescription": "GI WIRE 8 SWG",
        "sapUom": "KG",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000243",
            "desc": "GI WIRE 8 SWG",
            "uom": "KG",
            "docHeader": "0031006347"
          }
        ]
      }
    ]
  },
  "916": {
    "title": "916: Erection, Testing & Commissioning of 11kv 3Cx95 mm2 XLPE UG cable (1 KM)",
    "materials": [
      {
        "no": "1",
        "desc": "Laying and Excavation of XLPE Cable 11 KV, 3 C / 95 mm sq.",
        "unit": "mtr",
        "rate": 225.0,
        "itemCode": "17004596",
        "sapDescription": "CABLE AL LT XLPE 1X120 SQMM ARM",
        "sapUom": "M",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17004596",
            "desc": "CABLE AL LT XLPE 1X120 SQMM ARM",
            "uom": "M",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "2",
        "desc": "R.C.C. Pipe 150 mm 2 M",
        "unit": "No",
        "rate": 10.0,
        "itemCode": "17001044",
        "sapDescription": "CI PIPE 150 MM DIA 3M LONG",
        "sapUom": "NO",
        "docHeader": "0031007467",
        "sapItems": [
          {
            "code": "17001044",
            "desc": "CI PIPE 150 MM DIA 3M LONG",
            "uom": "NO",
            "docHeader": "0031007467"
          }
        ]
      },
      {
        "no": "3",
        "desc": "Half round cement pipe (150mm X 1mtr)",
        "unit": "No.",
        "rate": 10.0,
        "itemCode": "11000336",
        "sapDescription": "CEMENT GRADE OPC 53",
        "sapUom": "KG",
        "docHeader": "0031003360",
        "sapItems": [
          {
            "code": "11000336",
            "desc": "CEMENT GRADE OPC 53",
            "uom": "KG",
            "docHeader": "0031003360"
          }
        ]
      },
      {
        "no": "4",
        "desc": "11 kV heat shrinkable Straight through joint kit for 3 C X 95",
        "unit": "No.",
        "rate": 2200.0,
        "itemCode": "17005057",
        "sapDescription": "JOINT KIT 11KV STRAIGHT THRU 3X95 SQMM",
        "sapUom": "NO",
        "docHeader": "0031007614",
        "sapItems": [
          {
            "code": "17005057",
            "desc": "JOINT KIT 11KV STRAIGHT THRU 3X95 SQMM",
            "uom": "NO",
            "docHeader": "0031007614"
          }
        ]
      },
      {
        "no": "5",
        "desc": "11 kV heat shrinkable Outdoor termination joint kit for 3 C X 95",
        "unit": "No.",
        "rate": 2000.0,
        "itemCode": "23002177",
        "sapDescription": "DISCHARGE ROD FOR 11 KV",
        "sapUom": "SET",
        "docHeader": "0031007576",
        "sapItems": [
          {
            "code": "23002177",
            "desc": "DISCHARGE ROD FOR 11 KV",
            "uom": "SET",
            "docHeader": "0031007576"
          }
        ]
      },
      {
        "no": "6",
        "desc": "Sand",
        "unit": "Cmt",
        "rate": 2000.0,
        "itemCode": "11000123",
        "sapDescription": "M SAND 0-6 MM",
        "sapUom": "KG",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "11000123",
            "desc": "M SAND 0-6 MM",
            "uom": "KG",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "7",
        "desc": "Misc. for XLPE U/G Cable",
        "unit": "LS",
        "rate": 1900.0,
        "itemCode": "17004596",
        "sapDescription": "CABLE AL LT XLPE 1X120 SQMM ARM",
        "sapUom": "M",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17004596",
            "desc": "CABLE AL LT XLPE 1X120 SQMM ARM",
            "uom": "M",
            "docHeader": "0031006347"
          }
        ]
      }
    ]
  },
  "934A": {
    "title": "934A: 11 KV Single circuit Pin type with AB cable 3Cx95+70 sqmm on 100x116 mm 10 mtr RSJ poles",
    "materials": [
      {
        "no": "1",
        "desc": "RSJ 116x100, 10 m long",
        "unit": "No.",
        "rate": 2100.0,
        "itemCode": "17001242",
        "sapDescription": "RSJ POLE 100X116 MM 10 MTR",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17001242",
            "desc": "RSJ POLE 100X116 MM 10 MTR",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "2",
        "desc": "RSJ 116x100, 9 m long",
        "unit": "No.",
        "rate": 2100.0,
        "itemCode": "17000004",
        "sapDescription": "RSJ POLE 100X116 MM 9 MTR",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000004",
            "desc": "RSJ POLE 100X116 MM 9 MTR",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "3",
        "desc": "Cut Point Set with Channel, angle and clamps",
        "unit": "Set",
        "rate": 750.0,
        "itemCode": "17001294",
        "sapDescription": "BARBED WIRE CLAMP 100X116 25X3X320 MM",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17005042",
            "desc": "MS-11KV CUT POINT CH-75X40X6X1310-9.35KG",
            "uom": "NO",
            "docHeader": "0031006347",
            "qty": 2
          },
          {
            "code": "17005043",
            "desc": "MS-11KV CP BRCING ANG-50X50X6X1000-4.5KG",
            "uom": "NO",
            "docHeader": "0031006347",
            "qty": 2
          },
          {
            "code": "17005049",
            "desc": "MS-FISH PLATE-50X10X254-0.99KG",
            "uom": "NO",
            "docHeader": "0031006347",
            "qty": 4
          },
          {
            "code": "17005046",
            "desc": "MS-BK CL A TYPE-100X116-50X10X390-1.53KG",
            "uom": "NO",
            "docHeader": "0031006347",
            "qty": 1
          },
          {
            "code": "17005041",
            "desc": "MS-11KV TOP CLEAT-75X40X6X325-2.44KG",
            "uom": "NO",
            "docHeader": "0031006347",
            "qty": 1
          },
          {
            "code": "17005047",
            "desc": "MS-STAY CL A TP-100X116-50X10X310-1.21KG",
            "uom": "NO",
            "docHeader": "0031006347",
            "qty": 2
          }
        ]
      },
      {
        "no": "4",
        "desc": "11 KV V cross arm with clamp",
        "unit": "No.",
        "rate": 50.0,
        "itemCode": "17001295",
        "sapDescription": "11 KV V CROSS ARM MS 100X50",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17001295",
            "desc": "11 KV V CROSS ARM MS 100X50",
            "uom": "NO",
            "docHeader": "0031006347",
            "qty": 1
          },
          {
            "code": "17005046",
            "desc": "MS-BK CL A TYPE-100X116-50X10X390-1.53KG",
            "uom": "NO",
            "docHeader": "0031006347",
            "qty": 1
          }
        ]
      },
      {
        "no": "5",
        "desc": "11 KV Top fitting with clamp",
        "unit": "No.",
        "rate": 20.0,
        "itemCode": "17005041",
        "sapDescription": "MS-11KV TOP CLEAT-75X40X6X325-2.44KG",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17005041",
            "desc": "MS-11KV TOP CLEAT-75X40X6X325-2.44KG",
            "uom": "NO",
            "docHeader": "0031006347",
            "qty": 1
          },
          {
            "code": "17005046",
            "desc": "MS-BK CL A TYPE-100X116-50X10X390-1.53KG",
            "uom": "NO",
            "docHeader": "0031006347",
            "qty": 1
          }
        ]
      },
      {
        "no": "6",
        "desc": "G.I.Nut Bolts",
        "unit": "Kg.",
        "rate": 3.0,
        "itemCode": "17000613",
        "sapDescription": "HDG BOLT FT M12X150 NUT 1 SPRG 1 PL",
        "sapUom": "KG",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000613",
            "desc": "HDG BOLT FT M12X150 NUT 1 SPRG 1 PL",
            "uom": "KG",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "7",
        "desc": "11 kV Pin Insulators with G.I. Pins",
        "unit": "No.",
        "rate": 15.0,
        "itemCode": "17001397",
        "sapDescription": "PIN INSULATOR WITH GI PIN 11KV 5KN",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17001397",
            "desc": "PIN INSULATOR WITH GI PIN 11KV 5KN",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "8",
        "desc": "Disc Insulator 11 KV 70 KN",
        "unit": "No.",
        "rate": 30.0,
        "itemCode": "17000046",
        "sapDescription": "DISC INSULATOR 11KV 70KN B & S POLY",
        "sapUom": "NO",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000046",
            "desc": "DISC INSULATOR 11KV 70KN B & S POLY",
            "uom": "NO",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "9",
        "desc": "Strain Hardware for 55 Sq.mm AAAC",
        "unit": "Set",
        "rate": 20.0,
        "itemCode": "17000702",
        "sapDescription": "STRAIN HARDWARE FOR ACSR DOG B&S TY",
        "sapUom": "SET",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000702",
            "desc": "STRAIN HARDWARE FOR ACSR DOG B&S TY",
            "uom": "SET",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "10",
        "desc": "11 kV HT Covered Conductor",
        "unit": "Rmt",
        "rate": 6,
        "itemCode": "17005597",
        "sapDescription": "COVERED CONDUCTOR 55 SQMM",
        "sapUom": "NO",
        "docHeader": "Ugam Industries",
        "sapItems": [
          {
            "code": "17005597",
            "desc": "COVERED CONDUCTOR 55 SQMM",
            "uom": "NO",
            "docHeader": "Ugam Industries"
          }
        ]
      },
      {
        "no": "11",
        "desc": "Sleve Joints",
        "unit": "No.",
        "rate": 10.0,
        "itemCode": "17000755",
        "sapDescription": "EYE BOLT",
        "sapUom": "NO",
        "docHeader": "0031005498",
        "sapItems": [
          {
            "code": "17000755",
            "desc": "EYE BOLT",
            "uom": "NO",
            "docHeader": "0031005498"
          }
        ]
      },
      {
        "no": "12",
        "desc": "H.T.Stay Set",
        "unit": "Set",
        "rate": 400.0,
        "itemCode": "17005052",
        "sapDescription": "MS-HT STAY SET 20 MM",
        "sapUom": "SET",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17005052",
            "desc": "MS-HT STAY SET 20 MM",
            "uom": "SET",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "13",
        "desc": "G.I.Stay Wire 7/4mm(8 SWG)",
        "unit": "Kg.",
        "rate": 5.0,
        "itemCode": "17000239",
        "sapDescription": "GI STAY WIRE 7/4 MM 8 SWG",
        "sapUom": "KG",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000239",
            "desc": "GI STAY WIRE 7/4 MM 8 SWG",
            "uom": "KG",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "14",
        "desc": "Earthing Sets H.T",
        "unit": "Set",
        "rate": 170.0,
        "itemCode": "17001369",
        "sapDescription": "EARTHING SET LT",
        "sapUom": "SET",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17001369",
            "desc": "EARTHING SET LT",
            "uom": "SET",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "15",
        "desc": "G.I.Barbed Wire A' type.",
        "unit": "Kg.",
        "rate": 10.0,
        "itemCode": "17000237",
        "sapDescription": "GI BARBED WIRE A TYPE",
        "sapUom": "KG",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000237",
            "desc": "GI BARBED WIRE A TYPE",
            "uom": "KG",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "16",
        "desc": "Danger Board in yard.",
        "unit": "No.",
        "rate": 5.0,
        "itemCode": "17000751",
        "sapDescription": "DANGER BOARD 11 KV 250X200 MM",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000751",
            "desc": "DANGER BOARD 11 KV 250X200 MM",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "17",
        "desc": "Concreting ration 1:3 6",
        "unit": "Cmt.",
        "rate": 2700.0,
        "itemCode": "11000336",
        "sapDescription": "CEMENT GRADE OPC 53",
        "sapUom": "CMT",
        "docHeader": "0031003360",
        "sapItems": [
          {
            "code": "11000336",
            "desc": "CEMENT GRADE OPC 53",
            "uom": "CMT",
            "docHeader": "0031003360"
          }
        ]
      },
      {
        "no": "18",
        "desc": "G.I.Wire 8 SWG/ 6 SWG",
        "unit": "Kg.",
        "rate": 2.2,
        "itemCode": "17000243",
        "sapDescription": "GI WIRE 8 SWG",
        "sapUom": "KG",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000243",
            "desc": "GI WIRE 8 SWG",
            "uom": "KG",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "19",
        "desc": "Black Bituminus Paint",
        "unit": "LTR",
        "rate": 10.0,
        "itemCode": "17000776",
        "sapDescription": "PAINT BLACK BITUMINUS",
        "sapUom": "LTR",
        "docHeader": "0031007244",
        "sapItems": [
          {
            "code": "17000776",
            "desc": "PAINT BLACK BITUMINUS",
            "uom": "LTR",
            "docHeader": "0031007244"
          }
        ]
      },
      {
        "no": "20",
        "desc": "Red Oxide Paint for 1 coats",
        "unit": "LTR",
        "rate": 14.0,
        "itemCode": "17000776",
        "sapDescription": "PAINT RED OXIDE ZINC CHROMATE",
        "sapUom": "LTR",
        "docHeader": "0031007244",
        "sapItems": [
          {
            "code": "17000776",
            "desc": "PAINT RED OXIDE ZINC CHROMATE",
            "uom": "LTR",
            "docHeader": "0031007244"
          }
        ]
      },
      {
        "no": "21",
        "desc": "Aluminium Paint for 1 coat",
        "unit": "LTR",
        "rate": 10.0,
        "itemCode": "17000775",
        "sapDescription": "PAINT ALUMINIUM",
        "sapUom": "L",
        "docHeader": "0031007244",
        "sapItems": [
          {
            "code": "17000775",
            "desc": "PAINT ALUMINIUM",
            "uom": "L",
            "docHeader": "0031007244"
          }
        ]
      },
      {
        "no": "22",
        "desc": "Sundries",
        "unit": "Ls",
        "rate": 0.0,
        "itemCode": "20000001",
        "sapDescription": "DIESEL",
        "sapUom": "L",
        "docHeader": "DIESEL USED IN AS01FD3472",
        "sapItems": [
          {
            "code": "20000001",
            "desc": "DIESEL",
            "uom": "L",
            "docHeader": "DIESEL USED IN AS01FD3472"
          }
        ]
      },
      {
        "no": "23",
        "desc": "Wedge connectors",
        "unit": "No",
        "rate": 5.0,
        "itemCode": "17001358",
        "sapDescription": "WEDGE CONNECTORS DOG TO DOG",
        "sapUom": "NO",
        "docHeader": "Cancellation of QM UD pos",
        "sapItems": [
          {
            "code": "17001358",
            "desc": "WEDGE CONNECTORS DOG TO DOG",
            "uom": "NO",
            "docHeader": "Cancellation of QM UD pos"
          }
        ]
      },
      {
        "no": "23(a)",
        "desc": "DOG TO DOG or equivalent AAAC",
        "unit": "No",
        "rate": 3.0,
        "itemCode": "17001358",
        "sapDescription": "WEDGE CONNECTORS DOG TO DOG",
        "sapUom": "NO",
        "docHeader": "Cancellation of QM UD pos",
        "sapItems": [
          {
            "code": "17001358",
            "desc": "WEDGE CONNECTORS DOG TO DOG",
            "uom": "NO",
            "docHeader": "Cancellation of QM UD pos"
          }
        ]
      }
    ]
  },
  "1220": {
    "title": "1220: 100 KVA Dist. Transformer centers on RSJ , 100 X 116 mm, 11 mtr with Kitkat Dist box",
    "materials": [
      {
        "no": "1",
        "desc": "Dist. Transformer 100 KVA 11/0.43 kv",
        "unit": "No",
        "rate": 3000.0,
        "itemCode": "17000081",
        "sapDescription": "DIST BOX WITH KITKAT FOR 100 KVA DTC",
        "sapUom": "NO",
        "docHeader": "0031003360",
        "sapItems": [
          {
            "code": "17000081",
            "desc": "DIST BOX WITH KITKAT FOR 100 KVA DTC",
            "uom": "NO",
            "docHeader": "0031003360"
          }
        ]
      },
      {
        "no": "2",
        "desc": "RSJ 116x100, 11 m long",
        "unit": "No",
        "rate": 2500.0,
        "itemCode": "17001243",
        "sapDescription": "RSJ POLE 100X116 MM 11 MTR",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17001243",
            "desc": "RSJ POLE 100X116 MM 11 MTR",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "3",
        "desc": "Top & Bottom MS Channel (100x50x6 mm)",
        "unit": "No",
        "rate": 250.0,
        "itemCode": "17002007",
        "sapDescription": "MS CHANNEL 100X50X6 MM",
        "sapUom": "MT",
        "docHeader": "CUST PURCHASED TO CLINET",
        "sapItems": [
          {
            "code": "17002007",
            "desc": "MS CHANNEL 100X50X6 MM",
            "uom": "MT",
            "docHeader": "CUST PURCHASED TO CLINET"
          }
        ]
      },
      {
        "no": "4",
        "desc": "AB Switch, HG Fuse, LTDB Channel (75x40x6 mm) with Support Angle",
        "unit": "No",
        "rate": 250.0,
        "itemCode": "17000023",
        "sapDescription": "AB SWITCH 11 KV 400 AMP",
        "sapUom": "SET",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000023",
            "desc": "AB SWITCH 11 KV 400 AMP",
            "uom": "SET",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "5",
        "desc": "M.S.Flat 50 x 6 mm for Stay and Back Clamp",
        "unit": "No",
        "rate": 12.0,
        "itemCode": "17001294",
        "sapDescription": "BARBED WIRE CLAMP 100X116 25X3X320 MM",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17001294",
            "desc": "BARBED WIRE CLAMP 100X116 25X3X320 MM",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "6",
        "desc": "11 kV Pin Insulators with G.I. Pins",
        "unit": "No",
        "rate": 15.0,
        "itemCode": "17001397",
        "sapDescription": "PIN INSULATOR WITH GI PIN 11KV 5KN",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17001397",
            "desc": "PIN INSULATOR WITH GI PIN 11KV 5KN",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "7",
        "desc": "L.T.Dist.Boxes 100 KVA with KITKAT",
        "unit": "No",
        "rate": 900.0,
        "itemCode": "17000081",
        "sapDescription": "DIST BOX WITH KITKAT FOR 100 KVA DTC",
        "sapUom": "NO",
        "docHeader": "0031003360",
        "sapItems": [
          {
            "code": "17000081",
            "desc": "DIST BOX WITH KITKAT FOR 100 KVA DTC",
            "uom": "NO",
            "docHeader": "0031003360"
          }
        ]
      },
      {
        "no": "8",
        "desc": "L.As. 11 KV (Gapless type) with disconector",
        "unit": "Set",
        "rate": 800.0,
        "itemCode": "17000128",
        "sapDescription": "LA 11 KV GAPLESS WITH DISCONNECTOR",
        "sapUom": "SET",
        "docHeader": "0031006106",
        "sapItems": [
          {
            "code": "17000128",
            "desc": "LA 11 KV GAPLESS WITH DISCONNECTOR",
            "uom": "SET",
            "docHeader": "0031006106"
          }
        ]
      },
      {
        "no": "9",
        "desc": "H.T.Stay Set",
        "unit": "Set",
        "rate": 400.0,
        "itemCode": "17005052",
        "sapDescription": "MS-HT STAY SET 20 MM",
        "sapUom": "SET",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17005052",
            "desc": "MS-HT STAY SET 20 MM",
            "uom": "SET",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "10",
        "desc": "Earthing Sets H.T",
        "unit": "Set",
        "rate": 285.0,
        "itemCode": "17001369",
        "sapDescription": "EARTHING SET LT",
        "sapUom": "SET",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17001369",
            "desc": "EARTHING SET LT",
            "uom": "SET",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "11",
        "desc": "11KV H.G.Fuses",
        "unit": "Set",
        "rate": 900.0,
        "itemCode": "17000026",
        "sapDescription": "HORN GAP FUSE 11 KV",
        "sapUom": "SET",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000026",
            "desc": "HORN GAP FUSE 11 KV",
            "uom": "SET",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "12",
        "desc": "11KV A.B. Switch, 400 A",
        "unit": "Set",
        "rate": 1800.0,
        "itemCode": "17000023",
        "sapDescription": "AB SWITCH 11 KV 400 AMP",
        "sapUom": "SET",
        "docHeader": "70546447",
        "sapItems": [
          {
            "code": "17000023",
            "desc": "AB SWITCH 11 KV 400 AMP",
            "uom": "SET",
            "docHeader": "70546447"
          }
        ]
      },
      {
        "no": "13",
        "desc": "Danger Board in yard.",
        "unit": "No",
        "rate": 10.0,
        "itemCode": "17000751",
        "sapDescription": "DANGER BOARD 11 KV 250X200 MM",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000751",
            "desc": "DANGER BOARD 11 KV 250X200 MM",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "14",
        "desc": "Painting/Hardware & support with numbering of pole",
        "unit": "LS",
        "rate": 25.0,
        "itemCode": "17000004",
        "sapDescription": "RSJ POLE 100X116 MM 9 MTR",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000004",
            "desc": "RSJ POLE 100X116 MM 9 MTR",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "15",
        "desc": "DTC Metering Cth Box, single core L.T. XLPE cable (70 sq.mm. 120 mtr length) and other allied material",
        "unit": "No",
        "rate": 1600.0,
        "itemCode": "17000081",
        "sapDescription": "DIST BOX WITH KITKAT FOR 100 KVA",
        "sapUom": "NO",
        "docHeader": "0031003360",
        "sapItems": [
          {
            "code": "17000081",
            "desc": "DIST BOX WITH KITKAT FOR 100 KVA",
            "uom": "NO",
            "docHeader": "0031003360"
          }
        ]
      },
      {
        "no": "16",
        "desc": "Sundries",
        "unit": "LS",
        "rate": 0.0,
        "itemCode": "20000001",
        "sapDescription": "DIESEL",
        "sapUom": "L",
        "docHeader": "DIESEL USED IN AS01FD3472",
        "sapItems": [
          {
            "code": "20000001",
            "desc": "DIESEL",
            "uom": "L",
            "docHeader": "DIESEL USED IN AS01FD3472"
          }
        ]
      },
      {
        "no": "17",
        "desc": "Concreting ratio 1:3:6",
        "unit": "CMT",
        "rate": 2700.0,
        "itemCode": "11000336",
        "sapDescription": "CEMENT GRADE OPC 53",
        "sapUom": "CMT",
        "docHeader": "0031003360",
        "sapItems": [
          {
            "code": "11000336",
            "desc": "CEMENT GRADE OPC 53",
            "uom": "CMT",
            "docHeader": "0031003360"
          }
        ]
      },
      {
        "no": "18",
        "desc": "GI STAY WIRE (7X4MM DIA)",
        "unit": "Kg.",
        "rate": 3.0,
        "itemCode": "17000239",
        "sapDescription": "GI STAY WIRE 7/4 MM 8 SWG",
        "sapUom": "KG",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000239",
            "desc": "GI STAY WIRE 7/4 MM 8 SWG",
            "uom": "KG",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "19",
        "desc": "G.I. Barbed Wire",
        "unit": "Kg.",
        "rate": 5.0,
        "itemCode": "17000237",
        "sapDescription": "GI BARBED WIRE A TYPE",
        "sapUom": "KG",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000237",
            "desc": "GI BARBED WIRE A TYPE",
            "uom": "KG",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "20",
        "desc": "8 SWG GI WIRE FOR EARTHING & GUARDING",
        "unit": "Kg.",
        "rate": 2.0,
        "itemCode": "17000243",
        "sapDescription": "GI WIRE 8 SWG",
        "sapUom": "KG",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000243",
            "desc": "GI WIRE 8 SWG",
            "uom": "KG",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "21",
        "desc": "G.I.Nut Bolts",
        "unit": "Kg.",
        "rate": 3.0,
        "itemCode": "17000613",
        "sapDescription": "HDG BOLT FT M12X150 NUT 1 SPRG 1 PL",
        "sapUom": "KG",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000613",
            "desc": "HDG BOLT FT M12X150 NUT 1 SPRG 1 PL",
            "uom": "KG",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "22",
        "desc": "Disc Insulator 11 KV 70 KN",
        "unit": "No.",
        "rate": 30.0,
        "itemCode": "17000046",
        "sapDescription": "DISC INSULATOR 11KV 70KN B & S POLY",
        "sapUom": "NO",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000046",
            "desc": "DISC INSULATOR 11KV 70KN B & S POLY",
            "uom": "NO",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "23",
        "desc": "Strain Hardware for 55 Sq.mm AAAC",
        "unit": "No.",
        "rate": 20.0,
        "itemCode": "17000702",
        "sapDescription": "STRAIN HARDWARE FOR ACSR DOG B&S TY",
        "sapUom": "SET",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000702",
            "desc": "STRAIN HARDWARE FOR ACSR DOG B&S TY",
            "uom": "SET",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "24",
        "desc": "AAAC 55 mm2",
        "unit": "Rmt",
        "rate": 6.0,
        "itemCode": "17005597",
        "sapDescription": "COVERED CONDUCTOR 55 SQMM",
        "sapUom": "MTR",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17005597",
            "desc": "COVERED CONDUCTOR 55 SQMM",
            "uom": "MTR",
            "docHeader": "0031006347"
          }
        ]
      }
    ]
  },
  "1425A": {
    "title": "1425A: 3 phase 5 wire LT line with AAAC 55 sqmm for phase and ACSR Weasel for neutral on PSC pole, 8 mtr., 140 Kg",
    "materials": [
      {
        "no": "1",
        "desc": "PSC Pole 8 Mtr (140 KG)",
        "unit": "No",
        "rate": 1000.0,
        "itemCode": "17001240",
        "sapDescription": "PSC POLE 8 MTR 140 KGS",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17001240",
            "desc": "PSC POLE 8 MTR 140 KGS",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "2",
        "desc": "AAAC 55 mm2",
        "unit": "Rmt",
        "rate": 3.0,
        "itemCode": "17005597",
        "sapDescription": "COVERED CONDUCTOR 55 SQMM",
        "sapUom": "MTR",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17005597",
            "desc": "COVERED CONDUCTOR 55 SQMM",
            "uom": "MTR",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "3",
        "desc": "ACSR Weasel",
        "unit": "Rmt",
        "rate": 2.0,
        "itemCode": "17000120",
        "sapDescription": "ACSR WEASEL CONDUCTOR",
        "sapUom": "KM",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000120",
            "desc": "ACSR WEASEL CONDUCTOR",
            "uom": "KM",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "4",
        "desc": "MS angle 50x50x6 mm for LT Bracket",
        "unit": "No",
        "rate": 90.0,
        "itemCode": "17001390",
        "sapDescription": "MS ANGLE 50X50X6 MM",
        "sapUom": "NO",
        "docHeader": "0031006330",
        "sapItems": [
          {
            "code": "17001390",
            "desc": "MS ANGLE 50X50X6 MM",
            "uom": "NO",
            "docHeader": "0031006330"
          }
        ]
      },
      {
        "no": "5",
        "desc": "M.S. Flats(50 X 10mm) for Clamps",
        "unit": "Nos",
        "rate": 12.0,
        "itemCode": "17001294",
        "sapDescription": "BARBED WIRE CLAMP 100X116 25X3X320",
        "sapUom": "NOS",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17001294",
            "desc": "BARBED WIRE CLAMP 100X116 25X3X320",
            "uom": "NOS",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "6",
        "desc": "L.T.Shackle Insulator",
        "unit": "No",
        "rate": 6.0,
        "itemCode": "17000056",
        "sapDescription": "LT SHACKLE INSULATOR",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000056",
            "desc": "LT SHACKLE INSULATOR",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "7",
        "desc": "Aluminium Bobbins for neutral",
        "unit": "No.",
        "rate": 2.0,
        "itemCode": "17001150",
        "sapDescription": "ALUMINIUM BOBBINS",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17001150",
            "desc": "ALUMINIUM BOBBINS",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "8",
        "desc": "L.T.Shackle hardware",
        "unit": "Pair",
        "rate": 3.0,
        "itemCode": "17000700",
        "sapDescription": "LT SHACKLE HARDWARE FITTING",
        "sapUom": "PAIR",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000700",
            "desc": "LT SHACKLE HARDWARE FITTING",
            "uom": "PAIR",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "9",
        "desc": "Jointing Sleeves for AAC",
        "unit": "No",
        "rate": 5.0,
        "itemCode": "17004372",
        "sapDescription": "JOINTING SLEEVE AAAC RABBIT CONDUCTOR",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17004372",
            "desc": "JOINTING SLEEVE AAAC RABBIT CONDUCTOR",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "10",
        "desc": "PG Clamp",
        "unit": "No",
        "rate": 8.0,
        "itemCode": "17000700",
        "sapDescription": "PG CLAMP FOR ACSR WEASEL CONDUCTOR",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000700",
            "desc": "PG CLAMP FOR ACSR WEASEL CONDUCTOR",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "11",
        "desc": "Earthing Sets L.T.",
        "unit": "Set",
        "rate": 285.0,
        "itemCode": "17001369",
        "sapDescription": "EARTHING SET LT",
        "sapUom": "SET",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17001369",
            "desc": "EARTHING SET LT",
            "uom": "SET",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "12",
        "desc": "L.T. Stay sets",
        "unit": "Set",
        "rate": 400.0,
        "itemCode": "17005051",
        "sapDescription": "MS-LT STAY SET 16 MM",
        "sapUom": "SET",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17005051",
            "desc": "MS-LT STAY SET 16 MM",
            "uom": "SET",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "13",
        "desc": "G.I.Stay Wire 7/3.15mm(10SWG)",
        "unit": "Kg.",
        "rate": 8.0,
        "itemCode": "17000238",
        "sapDescription": "GI STAY WIRE 7/3.15 MM 10 SWG",
        "sapUom": "KG",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000238",
            "desc": "GI STAY WIRE 7/3.15 MM 10 SWG",
            "uom": "KG",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "14",
        "desc": "Stay Insulators",
        "unit": "No",
        "rate": 4.0,
        "itemCode": "17000058",
        "sapDescription": "LT STAY INSULATOR",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000058",
            "desc": "LT STAY INSULATOR",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "15",
        "desc": "Binding Wire",
        "unit": "Kg",
        "rate": 2.5,
        "itemCode": "17000235",
        "sapDescription": "ALUMINIUM BINDING WIRE",
        "sapUom": "KG",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000235",
            "desc": "ALUMINIUM BINDING WIRE",
            "uom": "KG",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "16",
        "desc": "Binding Tape",
        "unit": "Kg",
        "rate": 2.5,
        "itemCode": "17000234",
        "sapDescription": "ALUMINIUM BINDING TAPE",
        "sapUom": "KG",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000234",
            "desc": "ALUMINIUM BINDING TAPE",
            "uom": "KG",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "17",
        "desc": "G.I.Wire 8 SWG/ 6 SWG",
        "unit": "Kg.",
        "rate": 4.0,
        "itemCode": "17000243",
        "sapDescription": "GI WIRE 8 SWG",
        "sapUom": "KG",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000243",
            "desc": "GI WIRE 8 SWG",
            "uom": "KG",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "18",
        "desc": "L.T.Spacers",
        "unit": "No",
        "rate": 12.0,
        "itemCode": "17000056",
        "sapDescription": "LT SHACKLE INSULATOR",
        "sapUom": "NO",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000056",
            "desc": "LT SHACKLE INSULATOR",
            "uom": "NO",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "19",
        "desc": "G.I.Nut Bolts",
        "unit": "Kg",
        "rate": 3.0,
        "itemCode": "17000613",
        "sapDescription": "HDG BOLT FT M12X150 NUT 1 SPRG 1 PL",
        "sapUom": "KG",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000613",
            "desc": "HDG BOLT FT M12X150 NUT 1 SPRG 1 PL",
            "uom": "KG",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "19(a)",
        "desc": "Ant To Ant or equivalent AAAC",
        "unit": "No",
        "rate": 3.0,
        "itemCode": "17001357",
        "sapDescription": "WEDGE CONNECTORS ANT TO ANT",
        "sapUom": "NO",
        "docHeader": "0031006786",
        "sapItems": [
          {
            "code": "17001357",
            "desc": "WEDGE CONNECTORS ANT TO ANT",
            "uom": "NO",
            "docHeader": "0031006786"
          }
        ]
      },
      {
        "no": "19(b)",
        "desc": "GNAT To GNAT or equivalent AAAC",
        "unit": "No",
        "rate": 2.0,
        "itemCode": "17001359",
        "sapDescription": "WEDGE CONNECTORS GNAT TO GNAT",
        "sapUom": "NO",
        "docHeader": "0031006329",
        "sapItems": [
          {
            "code": "17001359",
            "desc": "WEDGE CONNECTORS GNAT TO GNAT",
            "uom": "NO",
            "docHeader": "0031006329"
          }
        ]
      },
      {
        "no": "20",
        "desc": "Sundries",
        "unit": "LS",
        "rate": 0.0,
        "itemCode": "20000001",
        "sapDescription": "DIESEL",
        "sapUom": "L",
        "docHeader": "DIESEL USED IN AS01FD3472",
        "sapItems": [
          {
            "code": "20000001",
            "desc": "DIESEL",
            "uom": "L",
            "docHeader": "DIESEL USED IN AS01FD3472"
          }
        ]
      },
      {
        "no": "21",
        "desc": "Concreting ratio 1:3:6",
        "unit": "CMT",
        "rate": 2700.0,
        "itemCode": "11000336",
        "sapDescription": "CEMENT GRADE OPC 53",
        "sapUom": "CMT",
        "docHeader": "0031003360",
        "sapItems": [
          {
            "code": "11000336",
            "desc": "CEMENT GRADE OPC 53",
            "uom": "CMT",
            "docHeader": "0031003360"
          }
        ]
      }
    ]
  },
  "6723": {
    "title": "6723: 11 kV A.B. Switch 400 Amp with DP structure",
    "materials": [
      {
        "no": "1",
        "desc": "11KV A.B. Switch, 400 A",
        "unit": "Set",
        "rate": 1800.0,
        "itemCode": "17000023",
        "sapDescription": "AB SWITCH 11 KV 400 AMP",
        "sapUom": "SET",
        "docHeader": "70546447",
        "sapItems": [
          {
            "code": "17000023",
            "desc": "AB SWITCH 11 KV 400 AMP",
            "uom": "SET",
            "docHeader": "70546447"
          }
        ]
      },
      {
        "no": "2",
        "desc": "MS Channel Top Channel (100x50x6 mm)",
        "unit": "No",
        "rate": 125.0,
        "itemCode": "17002007",
        "sapDescription": "MS CHANNEL 100X50X6 MM",
        "sapUom": "NO",
        "docHeader": "CUST PURCHASED TO CLINET",
        "sapItems": [
          {
            "code": "17002007",
            "desc": "MS CHANNEL 100X50X6 MM",
            "uom": "NO",
            "docHeader": "CUST PURCHASED TO CLINET"
          }
        ]
      },
      {
        "no": "3",
        "desc": "M.S.Channel AB switch (75x40x6 mm)",
        "unit": "No",
        "rate": 125.0,
        "itemCode": "17001391",
        "sapDescription": "MS CHANNEL 75X40X6 MM",
        "sapUom": "NO",
        "docHeader": "0031006330",
        "sapItems": [
          {
            "code": "17001391",
            "desc": "MS CHANNEL 75X40X6 MM",
            "uom": "NO",
            "docHeader": "0031006330"
          }
        ]
      },
      {
        "no": "4",
        "desc": "H.T.Stay Set",
        "unit": "Set",
        "rate": 600.0,
        "itemCode": "17005052",
        "sapDescription": "MS-HT STAY SET 20 MM",
        "sapUom": "SET",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17005052",
            "desc": "MS-HT STAY SET 20 MM",
            "uom": "SET",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "5",
        "desc": "Strain Hardware for Weasel/Squirrel",
        "unit": "Set",
        "rate": 10.0,
        "itemCode": "17000701",
        "sapDescription": "STRAIN HARDWARE FOR ACSR WEASEL",
        "sapUom": "SET",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000701",
            "desc": "STRAIN HARDWARE FOR ACSR WEASEL",
            "uom": "SET",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "6",
        "desc": "Disc Insulator 11 KV 70 KN",
        "unit": "No",
        "rate": 35.0,
        "itemCode": "17000046",
        "sapDescription": "DISC INSULATOR 11KV 70KN B & S POLY",
        "sapUom": "NO",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000046",
            "desc": "DISC INSULATOR 11KV 70KN B & S POLY",
            "uom": "NO",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "7",
        "desc": "RSJ 116x100, 9 m long",
        "unit": "No",
        "rate": 2100.0,
        "itemCode": "17000004",
        "sapDescription": "RSJ POLE 100X116 MM 9 MTR",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000004",
            "desc": "RSJ POLE 100X116 MM 9 MTR",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "8",
        "desc": "Concreting ratio 1:3:6",
        "unit": "CMT",
        "rate": 2700.0,
        "itemCode": "11000336",
        "sapDescription": "CEMENT GRADE OPC 53",
        "sapUom": "CMT",
        "docHeader": "0031003360",
        "sapItems": [
          {
            "code": "11000336",
            "desc": "CEMENT GRADE OPC 53",
            "uom": "CMT",
            "docHeader": "0031003360"
          }
        ]
      }
    ]
  },
  "924": {
    "title": "924: Single pole cut point Structure for 11kv line on RSJ 152x152, 11 m long pole with concreting",
    "materials": [
      {
        "no": "1",
        "desc": "RSJ 152x152, 11 m long",
        "unit": "No.",
        "rate": 3150.0,
        "itemCode": "17000007",
        "sapDescription": "RSJ POLE 152X152 MM 11 MTR",
        "sapUom": "NO",
        "docHeader": "0031006869",
        "sapItems": [
          {
            "code": "17000007",
            "desc": "RSJ POLE 152X152 MM 11 MTR",
            "uom": "NO",
            "docHeader": "0031006869"
          }
        ]
      },
      {
        "no": "2",
        "desc": "M.S.Cut Point Channel with complete set",
        "unit": "set",
        "rate": 650.0,
        "itemCode": "17005042",
        "sapDescription": "MS-11KV CUT POINT CH-75X40X6X1310-9.35KG",
        "sapUom": "NO",
        "docHeader": "0031003360",
        "sapItems": [
          {
            "code": "17005042",
            "desc": "MS-11KV CUT POINT CH-75X40X6X1310-9.35KG",
            "uom": "NO",
            "docHeader": "0031003360"
          }
        ]
      },
      {
        "no": "3",
        "desc": "Strain Hardware for Dog0.1 or Equ.AAAC.",
        "unit": "No.",
        "rate": 20.0,
        "itemCode": "17000702",
        "sapDescription": "STRAIN HARDWARE FOR ACSR DOG B&S TY",
        "sapUom": "SET",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000702",
            "desc": "STRAIN HARDWARE FOR ACSR DOG B&S TY",
            "uom": "SET",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "4",
        "desc": "Disc Insulator 11 KV 70 KN",
        "unit": "No.",
        "rate": 30.0,
        "itemCode": "17000046",
        "sapDescription": "DISC INSULATOR 11KV 70KN B & S POLY",
        "sapUom": "NO",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000046",
            "desc": "DISC INSULATOR 11KV 70KN B & S POLY",
            "uom": "NO",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "5",
        "desc": "H.T.Stay Set",
        "unit": "No.",
        "rate": 400.0,
        "itemCode": "17005052",
        "sapDescription": "MS-HT STAY SET 20 MM",
        "sapUom": "SET",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17005052",
            "desc": "MS-HT STAY SET 20 MM",
            "uom": "SET",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "6",
        "desc": "G.I.Stay Wire 7/4mm(8 SWG)",
        "unit": "Kg.",
        "rate": 5.0,
        "itemCode": "17000239",
        "sapDescription": "GI STAY WIRE 7/4 MM 8 SWG",
        "sapUom": "KG",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000239",
            "desc": "GI STAY WIRE 7/4 MM 8 SWG",
            "uom": "KG",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "7",
        "desc": "Earthing Sets H.T",
        "unit": "No.",
        "rate": 285.0,
        "itemCode": "17001369",
        "sapDescription": "EARTHING SET LT",
        "sapUom": "SET",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17001369",
            "desc": "EARTHING SET LT",
            "uom": "SET",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "8",
        "desc": "G.I.Wire 8 SWG/ 6 SWG",
        "unit": "Kg.",
        "rate": 4.0,
        "itemCode": "17000243",
        "sapDescription": "GI WIRE 8 SWG",
        "sapUom": "KG",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000243",
            "desc": "GI WIRE 8 SWG",
            "uom": "KG",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "9",
        "desc": "G.I.Barbed Wire A' type.",
        "unit": "Kg.",
        "rate": 3.0,
        "itemCode": "17000237",
        "sapDescription": "GI BARBED WIRE A TYPE",
        "sapUom": "KG",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000237",
            "desc": "GI BARBED WIRE A TYPE",
            "uom": "KG",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "10",
        "desc": "Black Bituminus Paint",
        "unit": "Ltr.",
        "rate": 10.0,
        "itemCode": "17000776",
        "sapDescription": "PAINT BLACK BITUMINUS",
        "sapUom": "LTR",
        "docHeader": "0031007244",
        "sapItems": [
          {
            "code": "17000776",
            "desc": "PAINT BLACK BITUMINUS",
            "uom": "LTR",
            "docHeader": "0031007244"
          }
        ]
      },
      {
        "no": "11",
        "desc": "Red Oxide Paint for 1 coats",
        "unit": "Ltr.",
        "rate": 14.0,
        "itemCode": "17000776",
        "sapDescription": "PAINT RED OXIDE ZINC CHROMATE",
        "sapUom": "LTR",
        "docHeader": "0031007244",
        "sapItems": [
          {
            "code": "17000776",
            "desc": "PAINT RED OXIDE ZINC CHROMATE",
            "uom": "LTR",
            "docHeader": "0031007244"
          }
        ]
      },
      {
        "no": "12",
        "desc": "Aluminium Paint for 1 coat",
        "unit": "Ltr.",
        "rate": 14.0,
        "itemCode": "17000775",
        "sapDescription": "PAINT ALUMINIUM",
        "sapUom": "L",
        "docHeader": "0031007244",
        "sapItems": [
          {
            "code": "17000775",
            "desc": "PAINT ALUMINIUM",
            "uom": "L",
            "docHeader": "0031007244"
          }
        ]
      },
      {
        "no": "13",
        "desc": "Danger Board in yard.",
        "unit": "No.",
        "rate": 10.0,
        "itemCode": "17000751",
        "sapDescription": "DANGER BOARD 11 KV 250X200 MM",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000751",
            "desc": "DANGER BOARD 11 KV 250X200 MM",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "14",
        "desc": "Concreting ratio 1:3 6",
        "unit": "Cmt.",
        "rate": 2700.0,
        "itemCode": "11000336",
        "sapDescription": "CEMENT GRADE OPC 53",
        "sapUom": "CMT",
        "docHeader": "0031003360",
        "sapItems": [
          {
            "code": "11000336",
            "desc": "CEMENT GRADE OPC 53",
            "uom": "CMT",
            "docHeader": "0031003360"
          }
        ]
      },
      {
        "no": "15",
        "desc": "Sundries",
        "unit": "Ls",
        "rate": 0.0,
        "itemCode": "20000001",
        "sapDescription": "DIESEL",
        "sapUom": "L",
        "docHeader": "DIESEL USED IN AS01FD3472",
        "sapItems": [
          {
            "code": "20000001",
            "desc": "DIESEL",
            "uom": "L",
            "docHeader": "DIESEL USED IN AS01FD3472"
          }
        ]
      }
    ]
  },
  "922": {
    "title": "922: Double pole cut point Structure for 11kv line on RSJ 116x100, 11 m long pole",
    "materials": [
      {
        "no": "1",
        "desc": "RSJ 116x100, 11 m long",
        "unit": "No.",
        "rate": 2500.0,
        "itemCode": "17001243",
        "sapDescription": "RSJ POLE 100X116 MM 11 MTR",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17001243",
            "desc": "RSJ POLE 100X116 MM 11 MTR",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "2",
        "desc": "M.S. Flats for stay & C clamps(50 X 10mm)",
        "unit": "Nos",
        "rate": 10.0,
        "itemCode": "17001294",
        "sapDescription": "BARBED WIRE CLAMP 100X116 25X3X320",
        "sapUom": "NOS",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17001294",
            "desc": "BARBED WIRE CLAMP 100X116 25X3X320",
            "uom": "NOS",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "3",
        "desc": "MS Top Channel 100x50x6 mm",
        "unit": "No",
        "rate": 250.0,
        "itemCode": "17002007",
        "sapDescription": "MS CHANNEL 100X50X6 MM",
        "sapUom": "NO",
        "docHeader": "CUST PURCHASED TO CLINET",
        "sapItems": [
          {
            "code": "17002007",
            "desc": "MS CHANNEL 100X50X6 MM",
            "uom": "NO",
            "docHeader": "CUST PURCHASED TO CLINET"
          }
        ]
      },
      {
        "no": "4",
        "desc": "M.S. Bottom Channel 75x40x6 mm",
        "unit": "No",
        "rate": 250.0,
        "itemCode": "17001391",
        "sapDescription": "MS CHANNEL 75X40X6 MM",
        "sapUom": "NO",
        "docHeader": "0031006330",
        "sapItems": [
          {
            "code": "17001391",
            "desc": "MS CHANNEL 75X40X6 MM",
            "uom": "NO",
            "docHeader": "0031006330"
          }
        ]
      },
      {
        "no": "5",
        "desc": "MS Bracing angle 50x50x6 mm",
        "unit": "No",
        "rate": 150.0,
        "itemCode": "17001390",
        "sapDescription": "MS ANGLE 50X50X6 MM",
        "sapUom": "NO",
        "docHeader": "0031006330",
        "sapItems": [
          {
            "code": "17001390",
            "desc": "MS ANGLE 50X50X6 MM",
            "uom": "NO",
            "docHeader": "0031006330"
          }
        ]
      },
      {
        "no": "6",
        "desc": "Strain Hardware for Dog0.1 or Equ.AAAC.",
        "unit": "No.",
        "rate": 20.0,
        "itemCode": "17000702",
        "sapDescription": "STRAIN HARDWARE FOR ACSR DOG B&S TY",
        "sapUom": "SET",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000702",
            "desc": "STRAIN HARDWARE FOR ACSR DOG B&S TY",
            "uom": "SET",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "7",
        "desc": "Disc Insulator 11 KV 70 KN",
        "unit": "No.",
        "rate": 30.0,
        "itemCode": "17000046",
        "sapDescription": "DISC INSULATOR 11KV 70KN B & S POLY",
        "sapUom": "NO",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000046",
            "desc": "DISC INSULATOR 11KV 70KN B & S POLY",
            "uom": "NO",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "8",
        "desc": "H.T.Stay Set",
        "unit": "No.",
        "rate": 400.0,
        "itemCode": "17005052",
        "sapDescription": "MS-HT STAY SET 20 MM",
        "sapUom": "SET",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17005052",
            "desc": "MS-HT STAY SET 20 MM",
            "uom": "SET",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "9",
        "desc": "G.I.Stay Wire 7/4mm(8 SWG)",
        "unit": "Kg.",
        "rate": 5.0,
        "itemCode": "17000239",
        "sapDescription": "GI STAY WIRE 7/4 MM 8 SWG",
        "sapUom": "KG",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000239",
            "desc": "GI STAY WIRE 7/4 MM 8 SWG",
            "uom": "KG",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "10",
        "desc": "Earthing Sets H.T",
        "unit": "No",
        "rate": 285.0,
        "itemCode": "17001369",
        "sapDescription": "EARTHING SET LT",
        "sapUom": "SET",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17001369",
            "desc": "EARTHING SET LT",
            "uom": "SET",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "11",
        "desc": "G.I.Wire 8 SWG/ 6 SWG",
        "unit": "kg.",
        "rate": 4.0,
        "itemCode": "17000243",
        "sapDescription": "GI WIRE 8 SWG",
        "sapUom": "KG",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000243",
            "desc": "GI WIRE 8 SWG",
            "uom": "KG",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "12",
        "desc": "G.I.Barbed Wire A' type.",
        "unit": "kg.",
        "rate": 3.0,
        "itemCode": "17000237",
        "sapDescription": "GI BARBED WIRE A TYPE",
        "sapUom": "KG",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000237",
            "desc": "GI BARBED WIRE A TYPE",
            "uom": "KG",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "13",
        "desc": "Danger Board in yard.",
        "unit": "No.",
        "rate": 10.0,
        "itemCode": "17000751",
        "sapDescription": "DANGER BOARD 11 KV 250X200 MM",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000751",
            "desc": "DANGER BOARD 11 KV 250X200 MM",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "14",
        "desc": "Black Bituminus Paint",
        "unit": "Ltr.",
        "rate": 10.0,
        "itemCode": "17000776",
        "sapDescription": "PAINT BLACK BITUMINUS",
        "sapUom": "LTR",
        "docHeader": "0031007244",
        "sapItems": [
          {
            "code": "17000776",
            "desc": "PAINT BLACK BITUMINUS",
            "uom": "LTR",
            "docHeader": "0031007244"
          }
        ]
      },
      {
        "no": "15",
        "desc": "Red Oxide Paint for 1 coats",
        "unit": "Ltr.",
        "rate": 14.0,
        "itemCode": "17000776",
        "sapDescription": "PAINT RED OXIDE ZINC CHROMATE",
        "sapUom": "LTR",
        "docHeader": "0031007244",
        "sapItems": [
          {
            "code": "17000776",
            "desc": "PAINT RED OXIDE ZINC CHROMATE",
            "uom": "LTR",
            "docHeader": "0031007244"
          }
        ]
      },
      {
        "no": "16",
        "desc": "Aluminium Paint for 1 coat",
        "unit": "Ltr.",
        "rate": 14.0,
        "itemCode": "17000775",
        "sapDescription": "PAINT ALUMINIUM",
        "sapUom": "L",
        "docHeader": "0031007244",
        "sapItems": [
          {
            "code": "17000775",
            "desc": "PAINT ALUMINIUM",
            "uom": "L",
            "docHeader": "0031007244"
          }
        ]
      },
      {
        "no": "17",
        "desc": "Concreting ratio 1:3 6",
        "unit": "Cmt.",
        "rate": 2700.0,
        "itemCode": "11000336",
        "sapDescription": "CEMENT GRADE OPC 53",
        "sapUom": "CMT",
        "docHeader": "0031003360",
        "sapItems": [
          {
            "code": "11000336",
            "desc": "CEMENT GRADE OPC 53",
            "uom": "CMT",
            "docHeader": "0031003360"
          }
        ]
      },
      {
        "no": "18",
        "desc": "Sundries",
        "unit": "L.S.",
        "rate": 0.0,
        "itemCode": "20000001",
        "sapDescription": "DIESEL",
        "sapUom": "L",
        "docHeader": "DIESEL USED IN AS01FD3472",
        "sapItems": [
          {
            "code": "20000001",
            "desc": "DIESEL",
            "uom": "L",
            "docHeader": "DIESEL USED IN AS01FD3472"
          }
        ]
      }
    ]
  },
  "919": {
    "title": "919: River crossing with 55sqmm overhead on 152X152 mm, 13mtr RSJ poles",
    "materials": [
      {
        "no": "1",
        "desc": "RSJ 152x152, 13 m long",
        "unit": "No.",
        "rate": 4000.0,
        "itemCode": "17000008",
        "sapDescription": "RSJ POLE 152X152 MM 13 MTR",
        "sapUom": "NO",
        "docHeader": "0031006869",
        "sapItems": [
          {
            "code": "17000008",
            "desc": "RSJ POLE 152X152 MM 13 MTR",
            "uom": "NO",
            "docHeader": "0031006869"
          }
        ]
      },
      {
        "no": "2",
        "desc": "M.S.Bottom Channel 75x40x6 mm",
        "unit": "no",
        "rate": 250.0,
        "itemCode": "17001391",
        "sapDescription": "MS CHANNEL 75X40X6 MM",
        "sapUom": "MT",
        "docHeader": "0031006330",
        "sapItems": [
          {
            "code": "17001391",
            "desc": "MS CHANNEL 75X40X6 MM",
            "uom": "MT",
            "docHeader": "0031006330"
          }
        ]
      },
      {
        "no": "3",
        "desc": "MS Top Channel 100x50x6 mm",
        "unit": "no",
        "rate": 250.0,
        "itemCode": "17002007",
        "sapDescription": "MS CHANNEL 100X50X6 MM",
        "sapUom": "NO",
        "docHeader": "CUST PURCHASED TO CLINET",
        "sapItems": [
          {
            "code": "17002007",
            "desc": "MS CHANNEL 100X50X6 MM",
            "uom": "NO",
            "docHeader": "CUST PURCHASED TO CLINET"
          }
        ]
      },
      {
        "no": "4",
        "desc": "MS cross bracing angle 50x50x6 mm",
        "unit": "no",
        "rate": 150.0,
        "itemCode": "17001390",
        "sapDescription": "MS ANGLE 50X50X6 MM",
        "sapUom": "MT",
        "docHeader": "0031006330",
        "sapItems": [
          {
            "code": "17001390",
            "desc": "MS ANGLE 50X50X6 MM",
            "uom": "MT",
            "docHeader": "0031006330"
          }
        ]
      },
      {
        "no": "5",
        "desc": "M.S. Flats for stay & C clamps(50 X 10mm)",
        "unit": "no",
        "rate": 10.0,
        "itemCode": "17001294",
        "sapDescription": "BARBED WIRE CLAMP 100X116 25X3X320",
        "sapUom": "NOS",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17001294",
            "desc": "BARBED WIRE CLAMP 100X116 25X3X320",
            "uom": "NOS",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "6",
        "desc": "AAAC 55 mm2",
        "unit": "Mtr",
        "rate": 4.0,
        "itemCode": "17005597",
        "sapDescription": "COVERED CONDUCTOR 55 SQMM",
        "sapUom": "MTR",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17005597",
            "desc": "COVERED CONDUCTOR 55 SQMM",
            "uom": "MTR",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "7",
        "desc": "11 kV Pin Insulators with G.I. Pins",
        "unit": "NO.",
        "rate": 15.0,
        "itemCode": "17001397",
        "sapDescription": "PIN INSULATOR WITH GI PIN 11KV 5KN",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17001397",
            "desc": "PIN INSULATOR WITH GI PIN 11KV 5KN",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "8",
        "desc": "Disc Insulator 11 KV 45 KN",
        "unit": "NO.",
        "rate": 30.0,
        "itemCode": "17000046",
        "sapDescription": "DISC INSULATOR 11KV 70KN B & S POLYMER",
        "sapUom": "NO",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000046",
            "desc": "DISC INSULATOR 11KV 70KN B & S POLYMER",
            "uom": "NO",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "9",
        "desc": "Strain Hardware for Dog0.1 or Equ.AAAC.",
        "unit": "No.",
        "rate": 20.0,
        "itemCode": "17000702",
        "sapDescription": "STRAIN HARDWARE FOR ACSR DOG B&S TY",
        "sapUom": "SET",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000702",
            "desc": "STRAIN HARDWARE FOR ACSR DOG B&S TY",
            "uom": "SET",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "10",
        "desc": "H.T.Stay Set",
        "unit": "Set",
        "rate": 400.0,
        "itemCode": "17005052",
        "sapDescription": "MS-HT STAY SET 20 MM",
        "sapUom": "SET",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17005052",
            "desc": "MS-HT STAY SET 20 MM",
            "uom": "SET",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "11",
        "desc": "G.I.Stay Wire 7/4mm(8 SWG)",
        "unit": "kg.",
        "rate": 5.0,
        "itemCode": "17000239",
        "sapDescription": "GI STAY WIRE 7/4 MM 8 SWG",
        "sapUom": "KG",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000239",
            "desc": "GI STAY WIRE 7/4 MM 8 SWG",
            "uom": "KG",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "12",
        "desc": "Earthing Sets H.T",
        "unit": "No.",
        "rate": 285.0,
        "itemCode": "17001369",
        "sapDescription": "EARTHING SET LT",
        "sapUom": "SET",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17001369",
            "desc": "EARTHING SET LT",
            "uom": "SET",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "13",
        "desc": "Danger Board in yard.",
        "unit": "No.",
        "rate": 10.0,
        "itemCode": "17000751",
        "sapDescription": "DANGER BOARD 11 KV 250X200 MM",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000751",
            "desc": "DANGER BOARD 11 KV 250X200 MM",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "14",
        "desc": "G.I.Wire 8 SWG/ 6 SWG",
        "unit": "Kg.",
        "rate": 4.0,
        "itemCode": "17000243",
        "sapDescription": "GI WIRE 8 SWG",
        "sapUom": "KG",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000243",
            "desc": "GI WIRE 8 SWG",
            "uom": "KG",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "15",
        "desc": "G.I.Barbed Wire A' type.",
        "unit": "kg.",
        "rate": 3.0,
        "itemCode": "17000237",
        "sapDescription": "GI BARBED WIRE A TYPE",
        "sapUom": "KG",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000237",
            "desc": "GI BARBED WIRE A TYPE",
            "uom": "KG",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "16",
        "desc": "Black Bituminus Paint",
        "unit": "Ltr.",
        "rate": 10.0,
        "itemCode": "17000776",
        "sapDescription": "PAINT BLACK BITUMINUS",
        "sapUom": "LTR",
        "docHeader": "0031007244",
        "sapItems": [
          {
            "code": "17000776",
            "desc": "PAINT BLACK BITUMINUS",
            "uom": "LTR",
            "docHeader": "0031007244"
          }
        ]
      },
      {
        "no": "17",
        "desc": "Red Oxide Paint for 1 coats",
        "unit": "Ltr.",
        "rate": 14.0,
        "itemCode": "17000776",
        "sapDescription": "PAINT RED OXIDE ZINC CHROMATE",
        "sapUom": "LTR",
        "docHeader": "0031007244",
        "sapItems": [
          {
            "code": "17000776",
            "desc": "PAINT RED OXIDE ZINC CHROMATE",
            "uom": "LTR",
            "docHeader": "0031007244"
          }
        ]
      },
      {
        "no": "18",
        "desc": "Aluminium Paint for 1 coat",
        "unit": "Ltr.",
        "rate": 14.0,
        "itemCode": "17000775",
        "sapDescription": "PAINT ALUMINIUM",
        "sapUom": "L",
        "docHeader": "0031007244",
        "sapItems": [
          {
            "code": "17000775",
            "desc": "PAINT ALUMINIUM",
            "uom": "L",
            "docHeader": "0031007244"
          }
        ]
      },
      {
        "no": "19",
        "desc": "Concreting ratio 1:3 6",
        "unit": "CMT.",
        "rate": 2700.0,
        "itemCode": "11000336",
        "sapDescription": "CEMENT GRADE OPC 53",
        "sapUom": "CMT",
        "docHeader": "0031003360",
        "sapItems": [
          {
            "code": "11000336",
            "desc": "CEMENT GRADE OPC 53",
            "uom": "CMT",
            "docHeader": "0031003360"
          }
        ]
      },
      {
        "no": "19(a)",
        "desc": "RABIT To RABIT or equivalent AAAC",
        "unit": "No",
        "rate": 11.0,
        "itemCode": "17001358",
        "sapDescription": "WEDGE CONNECTORS DOG TO DOG",
        "sapUom": "NO",
        "docHeader": "Cancellation of QM UD pos",
        "sapItems": [
          {
            "code": "17001358",
            "desc": "WEDGE CONNECTORS DOG TO DOG",
            "uom": "NO",
            "docHeader": "Cancellation of QM UD pos"
          }
        ]
      }
    ]
  },
  "907": {
    "title": "907: RSJ 116x100, 9 m long with V Cross arm, Top fitting and allied material (1 KM)",
    "materials": [
      {
        "no": "1",
        "desc": "RSJ 116x100, 9 m long",
        "unit": "No.",
        "rate": 2100.0,
        "itemCode": "17000004",
        "sapDescription": "RSJ POLE 100X116 MM 9 MTR",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000004",
            "desc": "RSJ POLE 100X116 MM 9 MTR",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "2",
        "desc": "RSJ 116x100, 8 m long",
        "unit": "No.",
        "rate": 1500.0,
        "itemCode": "17005037",
        "sapDescription": "RSJ POLE 100X116 MM 8 MTR",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17005037",
            "desc": "RSJ POLE 100X116 MM 8 MTR",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "3",
        "desc": "11 kv Guarding channel MS 75x40 with clamp",
        "unit": "Nos",
        "rate": 500.0,
        "itemCode": "17001391",
        "sapDescription": "MS CHANNEL 75X40X6 MM",
        "sapUom": "NOS",
        "docHeader": "0031006330",
        "sapItems": [
          {
            "code": "17001391",
            "desc": "MS CHANNEL 75X40X6 MM",
            "uom": "NOS",
            "docHeader": "0031006330",
            "qty": 1
          },
          {
            "code": "17005046",
            "desc": "MS-BK CL A TYPE-100X116-50X10X390-1.53KG",
            "uom": "NO",
            "docHeader": "0031006347",
            "qty": 1
          }
        ]
      },
      {
        "no": "4",
        "desc": "Cut Point Set with Channel, angle and clamps",
        "unit": "Set",
        "rate": 1250.0,
        "itemCode": "17001294",
        "sapDescription": "BARBED WIRE CLAMP 100X116 25X3X320 MM",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17005042",
            "desc": "MS-11KV CUT POINT CH-75X40X6X1310-9.35KG",
            "uom": "NO",
            "docHeader": "0031006347",
            "qty": 2
          },
          {
            "code": "17005043",
            "desc": "MS-11KV CP BRCING ANG-50X50X6X1000-4.5KG",
            "uom": "NO",
            "docHeader": "0031006347",
            "qty": 2
          },
          {
            "code": "17005049",
            "desc": "MS-FISH PLATE-50X10X254-0.99KG",
            "uom": "NO",
            "docHeader": "0031006347",
            "qty": 4
          },
          {
            "code": "17005046",
            "desc": "MS-BK CL A TYPE-100X116-50X10X390-1.53KG",
            "uom": "NO",
            "docHeader": "0031006347",
            "qty": 1
          },
          {
            "code": "17005041",
            "desc": "MS-11KV TOP CLEAT-75X40X6X325-2.44KG",
            "uom": "NO",
            "docHeader": "0031006347",
            "qty": 1
          },
          {
            "code": "17005047",
            "desc": "MS-STAY CL A TP-100X116-50X10X310-1.21KG",
            "uom": "NO",
            "docHeader": "0031006347",
            "qty": 2
          }
        ]
      },
      {
        "no": "5",
        "desc": "11 KV V cross arm with clamp",
        "unit": "No.",
        "rate": 50.0,
        "itemCode": "17001295",
        "sapDescription": "11 KV V CROSS ARM MS 100X50",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17001295",
            "desc": "11 KV V CROSS ARM MS 100X50",
            "uom": "NO",
            "docHeader": "0031006347",
            "qty": 1
          },
          {
            "code": "17005046",
            "desc": "MS-BK CL A TYPE-100X116-50X10X390-1.53KG",
            "uom": "NO",
            "docHeader": "0031006347",
            "qty": 1
          }
        ]
      },
      {
        "no": "6",
        "desc": "11 KV Top fitting with clamp",
        "unit": "No.",
        "rate": 20.0,
        "itemCode": "17005041",
        "sapDescription": "MS-11KV TOP CLEAT-75X40X6X325-2.44KG",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17005041",
            "desc": "MS-11KV TOP CLEAT-75X40X6X325-2.44KG",
            "uom": "NO",
            "docHeader": "0031006347",
            "qty": 1
          },
          {
            "code": "17005046",
            "desc": "MS-BK CL A TYPE-100X116-50X10X390-1.53KG",
            "uom": "NO",
            "docHeader": "0031006347",
            "qty": 1
          }
        ]
      },
      {
        "no": "7",
        "desc": "G.I.Nut Bolts",
        "unit": "Kg.",
        "rate": 3.0,
        "itemCode": "17000613",
        "sapDescription": "HDG BOLT FT M12X150 NUT 1 SPRG 1 PL",
        "sapUom": "KG",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000613",
            "desc": "HDG BOLT FT M12X150 NUT 1 SPRG 1 PL",
            "uom": "KG",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "8",
        "desc": "11 kV Pin Insulators with G.I. Pins",
        "unit": "No.",
        "rate": 15.0,
        "itemCode": "17001397",
        "sapDescription": "PIN INSULATOR WITH GI PIN 11KV 5KN",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17001397",
            "desc": "PIN INSULATOR WITH GI PIN 11KV 5KN",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "9",
        "desc": "Disc Insulator 11 KV 70 KN",
        "unit": "No.",
        "rate": 30.0,
        "itemCode": "17000046",
        "sapDescription": "DISC INSULATOR 11KV 70KN B & S POLY",
        "sapUom": "NO",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000046",
            "desc": "DISC INSULATOR 11KV 70KN B & S POLY",
            "uom": "NO",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "10",
        "desc": "Strain Hardware for 55 Sq.mm AAAC",
        "unit": "Set",
        "rate": 20.0,
        "itemCode": "17000702",
        "sapDescription": "STRAIN HARDWARE FOR ACSR DOG B&S TY",
        "sapUom": "SET",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000702",
            "desc": "STRAIN HARDWARE FOR ACSR DOG B&S TY",
            "uom": "SET",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "11",
        "desc": "AAAC 55 mm2",
        "unit": "Rmt",
        "rate": 6.0,
        "itemCode": "17005597",
        "sapDescription": "COVERED CONDUCTOR 55 SQMM",
        "sapUom": "MTR",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17005597",
            "desc": "COVERED CONDUCTOR 55 SQMM",
            "uom": "MTR",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "12",
        "desc": "Sleeve Joints",
        "unit": "No.",
        "rate": 10.0,
        "itemCode": "17004372",
        "sapDescription": "JOINTING SLEEVE AAAC RABBIT CONDUCTOR",
        "sapUom": "NO",
        "docHeader": "0031006329",
        "sapItems": [
          {
            "code": "17004372",
            "desc": "JOINTING SLEEVE AAAC RABBIT CONDUCTOR",
            "uom": "NO",
            "docHeader": "0031006329"
          }
        ]
      },
      {
        "no": "13",
        "desc": "H.T.Stay Set",
        "unit": "Set",
        "rate": 400.0,
        "itemCode": "17005052",
        "sapDescription": "MS-HT STAY SET 20 MM",
        "sapUom": "SET",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17005052",
            "desc": "MS-HT STAY SET 20 MM",
            "uom": "SET",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "14",
        "desc": "G.I.Stay Wire 7/4mm(8 SWG)",
        "unit": "Kg.",
        "rate": 5.0,
        "itemCode": "17000239",
        "sapDescription": "GI STAY WIRE 7/4 MM 8 SWG",
        "sapUom": "KG",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17000239",
            "desc": "GI STAY WIRE 7/4 MM 8 SWG",
            "uom": "KG",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "15",
        "desc": "Earthing Sets H.T",
        "unit": "Set",
        "rate": 170.0,
        "itemCode": "17001369",
        "sapDescription": "EARTHING SET LT",
        "sapUom": "SET",
        "docHeader": "0031007012",
        "sapItems": [
          {
            "code": "17001369",
            "desc": "EARTHING SET LT",
            "uom": "SET",
            "docHeader": "0031007012"
          }
        ]
      },
      {
        "no": "16",
        "desc": "G.I.Barbed Wire A' type",
        "unit": "Kg.",
        "rate": 10.0,
        "itemCode": "17000237",
        "sapDescription": "GI BARBED WIRE A TYPE",
        "sapUom": "KG",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000237",
            "desc": "GI BARBED WIRE A TYPE",
            "uom": "KG",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "17",
        "desc": "Danger Board in yard",
        "unit": "No.",
        "rate": 5.0,
        "itemCode": "17000751",
        "sapDescription": "DANGER BOARD 11 KV 250X200 MM",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000751",
            "desc": "DANGER BOARD 11 KV 250X200 MM",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "18",
        "desc": "Concreting ratio 1:3:6 (14 CMT)",
        "unit": "Cmt.",
        "rate": 2700.0,
        "itemCode": "11000336",
        "sapDescription": "CEMENT GRADE OPC 53",
        "sapUom": "CMT",
        "docHeader": "0031003360",
        "sapItems": [
          {
            "code": "11000336",
            "desc": "CEMENT GRADE OPC 53",
            "uom": "CMT",
            "docHeader": "0031003360"
          }
        ]
      },
      {
        "no": "19",
        "desc": "G.I.Wire 8 SWG / 6 SWG",
        "unit": "Kg.",
        "rate": 2.0,
        "itemCode": "17000243",
        "sapDescription": "GI WIRE 8 SWG",
        "sapUom": "KG",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17000243",
            "desc": "GI WIRE 8 SWG",
            "uom": "KG",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "20",
        "desc": "Black Bituminus Paint",
        "unit": "Ltr",
        "rate": 10.0,
        "itemCode": "17000776",
        "sapDescription": "PAINT BLACK BITUMINUS",
        "sapUom": "LTR",
        "docHeader": "0031007244",
        "sapItems": [
          {
            "code": "17000776",
            "desc": "PAINT BLACK BITUMINUS",
            "uom": "LTR",
            "docHeader": "0031007244"
          }
        ]
      },
      {
        "no": "21",
        "desc": "Red Oxide Paint for 1 coats",
        "unit": "Ltr",
        "rate": 14.0,
        "itemCode": "17000776",
        "sapDescription": "PAINT RED OXIDE ZINC CHROMATE",
        "sapUom": "LTR",
        "docHeader": "0031007244",
        "sapItems": [
          {
            "code": "17000776",
            "desc": "PAINT RED OXIDE ZINC CHROMATE",
            "uom": "LTR",
            "docHeader": "0031007244"
          }
        ]
      },
      {
        "no": "22",
        "desc": "Aluminium Paint for 1 coat",
        "unit": "Ltr",
        "rate": 10.0,
        "itemCode": "17000775",
        "sapDescription": "PAINT ALUMINIUM",
        "sapUom": "L",
        "docHeader": "0031007244",
        "sapItems": [
          {
            "code": "17000775",
            "desc": "PAINT ALUMINIUM",
            "uom": "L",
            "docHeader": "0031007244"
          }
        ]
      },
      {
        "no": "23",
        "desc": "Wedge connectors RABIT To RABIT or equivalent AAAC",
        "unit": "Nos",
        "rate": 5.0,
        "itemCode": "17001357",
        "sapDescription": "WEDGE CONNECTORS ANT TO ANT",
        "sapUom": "NO",
        "docHeader": "0031006786",
        "sapItems": [
          {
            "code": "17001357",
            "desc": "WEDGE CONNECTORS ANT TO ANT",
            "uom": "NO",
            "docHeader": "0031006786"
          }
        ]
      },
      {
        "no": "24",
        "desc": "RSJ 116x100, 11 m long",
        "unit": "No.",
        "rate": 2500.0,
        "itemCode": "17001243",
        "sapDescription": "RSJ POLE 100X116 MM 11 MTR",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17001243",
            "desc": "RSJ POLE 100X116 MM 11 MTR",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      },
      {
        "no": "25",
        "desc": "RSJ 116x100, 10 m long",
        "unit": "No.",
        "rate": 2100.0,
        "itemCode": "17001242",
        "sapDescription": "RSJ POLE 100X116 MM 10 MTR",
        "sapUom": "NO",
        "docHeader": "0031006347",
        "sapItems": [
          {
            "code": "17001242",
            "desc": "RSJ POLE 100X116 MM 10 MTR",
            "uom": "NO",
            "docHeader": "0031006347"
          }
        ]
      }
    ]
  }
};
