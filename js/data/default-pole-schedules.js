/**
 * @file Pole Schedules Master Data
 * @description Master configurations for Pole Schedules (907 and 922)
 * with complete item codes, descriptions, units, SAP mappings, section headers, and highlights.
 * 
 * @global {Object} defaultPoleSchedules
 * @readonly
 */

const defaultPoleSchedules = {
  "907": {
    title: "Activity 907 Pole Schedule — 11 KV Line on RSJ Pole with V-Cross Arm & Allied Materials",
    activityCode: "907",
    materials: [
      { no: "", itemCode: "", desc: "Span", unit: "Cmt.", rate: 0, isSpan: true },
      { no: "", itemCode: "", desc: "Cover Conductor Span", unit: "Cmt.", rate: 0, isSpan: true },
      { no: "1", itemCode: "17001243", desc: "RSJ 116x100, 11 m long", unit: "No.", rate: 2500, sapDescription: "RSJ POLE 100X116 MM 11 MTR", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17001243", desc: "RSJ POLE 100X116 MM 11 MTR", uom: "NO", docHeader: "0031006347" }] },
      { no: "2", itemCode: "17001242", desc: "RSJ 116x100, 10 m long", unit: "No.", rate: 2300, sapDescription: "RSJ POLE 100X116 MM 10 MTR", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17001242", desc: "RSJ POLE 100X116 MM 10 MTR", uom: "NO", docHeader: "0031006347" }] },
      { no: "3", itemCode: "17000004", desc: "RSJ 116x100, 9 m long", unit: "No.", rate: 2100, sapDescription: "RSJ POLE 100X116 MM 9 MTR", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17000004", desc: "RSJ POLE 100X116 MM 9 MTR", uom: "NO", docHeader: "0031006347" }] },
      { no: "4", itemCode: "17005037", desc: "RSJ 116x100, 8 m long", unit: "No.", rate: 1500, sapDescription: "RSJ POLE 100X116 MM 8 MTR", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005037", desc: "RSJ POLE 100X116 MM 8 MTR", uom: "NO", docHeader: "0031006347" }] },
      { no: "", itemCode: "", desc: "11 kv guarding channel MS 75x40", unit: "Kg.", rate: 0, isSection: true },
      { no: "5", itemCode: "17004792", desc: "11 kv Guarding channel MS 75x40 with clamp", unit: "No.", rate: 500, sapDescription: "11KV GUARDING CHANNEL 75X40X2210-15.78KG", sapUom: "SET", docHeader: "0031006330", sapItems: [{ code: "17004792", desc: "11KV GUARDING CHANNEL 75X40X2210-15.78KG", uom: "SET", docHeader: "0031006330" }] },
      { no: "", itemCode: "", desc: "M.S.Channel 75x40x6 mm", unit: "Kg.", rate: 0, isSection: true },
      { no: "6", itemCode: "", desc: "Top Cleat (Extension)", unit: "Nos", rate: 50, sapDescription: "MS-11KV TOP CLEAT EXTENSION", sapUom: "NOS", docHeader: "0031006347", sapItems: [] },
      { no: "7", itemCode: "17005041", desc: "Top Cleat SPCP", unit: "Nos", rate: 35, sapDescription: "MS-11KV TOP CLEAT-75X40X6X325-2.44KG", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005041", desc: "MS-11KV TOP CLEAT-75X40X6X325-2.44KG", uom: "NO", docHeader: "0031006347" }] },
      { no: "8", itemCode: "17005042", desc: "Cut Point Set with Channel,Angle and Clamps", unit: "Nos", rate: 1250, sapDescription: "MS-11KV CUT POINT CH-75X40X6X1310-9.35KG", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005042", desc: "MS-11KV CUT POINT CH-75X40X6X1310-9.35KG", uom: "NO", docHeader: "0031006347" }] },
      { no: "", itemCode: "", desc: "MS angle 50x50x6 mm", unit: "Kg.", rate: 0, isSection: true },
      { no: "9", itemCode: "17005043", desc: "MS angle 50x50x6 mm (tie angle)", unit: "No.", rate: 150, sapDescription: "MS-11KV CP BRCING ANG-50X50X6X1000-4.5KG", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005043", desc: "MS-11KV CP BRCING ANG-50X50X6X1000-4.5KG", uom: "NO", docHeader: "0031006347" }] },
      { no: "", itemCode: "", desc: "M.S.Flat 25 x 3 mm", unit: "Kg.", rate: 0, isSection: true },
      { no: "10", itemCode: "17001300", desc: "Danger Board Clamp", unit: "No", rate: 15, sapDescription: "DANGER BOARD CLAMP 100X116 25X3X465 MM", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17001300", desc: "DANGER BOARD CLAMP 100X116 25X3X465 MM", uom: "NO", docHeader: "0031006347" }] },
      { no: "11", itemCode: "17001294", desc: "Barbed Wire Clamp", unit: "Pair", rate: 15, sapDescription: "BARBED WIRE CLAMP 100X116 25X3X320 MM", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17001294", desc: "BARBED WIRE CLAMP 100X116 25X3X320 MM", uom: "NO", docHeader: "0031006347" }] },
      { no: "", itemCode: "", desc: "M.S. Flats(50 X 10mm)", unit: "Kg.", rate: 0, isSection: true },
      { no: "12", itemCode: "17005047", desc: "Stay Clamp A & B Type", unit: "Pair", rate: 50, sapDescription: "MS-STAY CL A TP-100X116-50X10X310-1.21KG", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005047", desc: "MS-STAY CL A TP-100X116-50X10X310-1.21KG", uom: "NO", docHeader: "0031006347" }] },
      { no: "13", itemCode: "17005049", desc: "Fish Plate/Strain Plate", unit: "Nos", rate: 30, sapDescription: "MS-FISH PLATE-50X10X254-0.99KG", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005049", desc: "MS-FISH PLATE-50X10X254-0.99KG", uom: "NO", docHeader: "0031006347" }] },
      { no: "14", itemCode: "17005046", desc: "Side Clamp A Type", unit: "Nos", rate: 40, sapDescription: "MS-BK CL A TYPE-100X116-50X10X390-1.53KG", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005046", desc: "MS-BK CL A TYPE-100X116-50X10X390-1.53KG", uom: "NO", docHeader: "0031006347" }] },
      { no: "15", itemCode: "17005085", desc: "Side Clamp B Type", unit: "Nos", rate: 40, sapDescription: "MS-BK CL B TYPE-100X116-50X10X400-1.57KG", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005085", desc: "MS-BK CL B TYPE-100X116-50X10X400-1.57KG", uom: "NO", docHeader: "0031006347" }] },
      { no: "16", itemCode: "17005046", desc: "Side Clamp for 11 KV V-Cross Arm (Extension)", unit: "Nos", rate: 40, sapDescription: "MS-BK CL A TYPE-100X116-50X10X390-1.53KG", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005046", desc: "MS-BK CL A TYPE-100X116-50X10X390-1.53KG", uom: "NO", docHeader: "0031006347" }] },
      { no: "17", itemCode: "17005046", desc: "Side Clamp for Guarding Channel", unit: "Nos", rate: 40, sapDescription: "MS-BK CL A TYPE-100X116-50X10X390-1.53KG", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005046", desc: "MS-BK CL A TYPE-100X116-50X10X390-1.53KG", uom: "NO", docHeader: "0031006347" }] },
      { no: "18", itemCode: "17005046", desc: "Side Clamp for Top Clit (Extension)", unit: "Nos", rate: 40, sapDescription: "MS-BK CL A TYPE-100X116-50X10X390-1.53KG", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005046", desc: "MS-BK CL A TYPE-100X116-50X10X390-1.53KG", uom: "NO", docHeader: "0031006347" }] },
      { no: "19", itemCode: "17005942", desc: "2m 11 KV V-Cross Arm (Extension)", unit: "No.", rate: 120, sapDescription: "HGT EXT CHANNEL 75X40X6X2000-14.28KG", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005942", desc: "HGT EXT CHANNEL 75X40X6X2000-14.28KG", uom: "NO", docHeader: "0031006347" }] },
      { no: "20", itemCode: "17005050", desc: "11 KV V cross arm with clamp", unit: "No.", rate: 50, sapDescription: "MS-11KV V-CROSS ARM-75X40X6X1614-11.99KG", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005050", desc: "MS-11KV V-CROSS ARM-75X40X6X1614-11.99KG", uom: "NO", docHeader: "0031006347" }] },
      { no: "21", itemCode: "17005041", desc: "11 KV Top fitting with clamp", unit: "No.", rate: 20, sapDescription: "MS-11KV TOP CLEAT-75X40X6X325-2.44KG", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005041", desc: "MS-11KV TOP CLEAT-75X40X6X325-2.44KG", uom: "NO", docHeader: "0031006347" }] },
      { no: "", itemCode: "", desc: "G.I.Nut Bolts", unit: "Kg.", rate: 0, isSection: true },
      { no: "22", itemCode: "17000625", desc: "N/B 16*75 (3 inch)", unit: "No.", rate: 25, sapDescription: "HDG BOLT FT M16X75 NUT 1 SPRG 1 PL WSHR", sapUom: "SET", docHeader: "0031006347", sapItems: [{ code: "17000625", desc: "HDG BOLT FT M16X75 NUT 1 SPRG 1 PL WSHR", uom: "SET", docHeader: "0031006347" }] },
      { no: "23", itemCode: "17000636", desc: "N/B 16*150 (6 inch)", unit: "No.", rate: 35, sapDescription: "HDG BOLT HT M16X150 NUT 1 SPRG 1 PL WSHR", sapUom: "SET", docHeader: "0031006347", sapItems: [{ code: "17000636", desc: "HDG BOLT HT M16X150 NUT 1 SPRG 1 PL WSHR", uom: "SET", docHeader: "0031006347" }] },
      { no: "24", itemCode: "17000627", desc: "N/B 6*75 (3 inch)", unit: "No.", rate: 12, sapDescription: "HDG BOLT FT M8X50 NUT 1 SPRG 1 PL WSHR", sapUom: "SET", docHeader: "0031006347", sapItems: [{ code: "17000627", desc: "HDG BOLT FT M8X50 NUT 1 SPRG 1 PL WSHR", uom: "SET", docHeader: "0031006347" }] },
      { no: "25", itemCode: "17001397", desc: "11 kV Pin Insulators with G.I. Pins", unit: "No.", rate: 45, sapDescription: "PIN INSULATOR WITH GI PIN 11KV 5KN POLY", sapUom: "SET", docHeader: "0031007012", sapItems: [{ code: "17001397", desc: "PIN INSULATOR WITH GI PIN 11KV 5KN POLY", uom: "SET", docHeader: "0031007012" }] },
      { no: "26", itemCode: "17000046", desc: "Disc Insulator 11 KV 70 KN", unit: "No.", rate: 75, sapDescription: "DISC INSULATOR 11KV 70KN B & S POLYMER", sapUom: "NO", docHeader: "0031007012", sapItems: [{ code: "17000046", desc: "DISC INSULATOR 11KV 70KN B & S POLYMER", uom: "NO", docHeader: "0031007012" }] },
      { no: "27", itemCode: "17000704", desc: "Strain Hardware for 55 Sq.mm AAAC", unit: "Set", rate: 35, sapDescription: "STRAIN HARDWARE FOR ACSR RABBIT B&S TYPE", sapUom: "NO", docHeader: "0031007012", sapItems: [{ code: "17000704", desc: "STRAIN HARDWARE FOR ACSR RABBIT B&S TYPE", uom: "NO", docHeader: "0031007012" }] },
      { no: "28", itemCode: "17000702", desc: "Dog Hardware", unit: "Set", rate: 40, sapDescription: "STRAIN HARDWARE FOR ACSR DOG B&S TYPE", sapUom: "SET", docHeader: "0031007012", sapItems: [{ code: "17000702", desc: "STRAIN HARDWARE FOR ACSR DOG B&S TYPE", uom: "SET", docHeader: "0031007012" }] },
      { no: "29", itemCode: "17001261", desc: "AAAC 55 mm2", unit: "Rmt", rate: 3, sapDescription: "AAAC RABBIT CONDUCTOR", sapUom: "KM", docHeader: "0031006347", sapItems: [{ code: "17001261", desc: "AAAC RABBIT CONDUCTOR", uom: "KM", docHeader: "0031006347" }] },
      { no: "30", itemCode: "17005597", desc: "AAAC 55 mm2 Cover Conductor", unit: "Rmt", rate: 5, sapDescription: "COVERED CONDUCTOR 55 SQMM", sapUom: "KM", docHeader: "0031006347", sapItems: [{ code: "17005597", desc: "COVERED CONDUCTOR 55 SQMM", uom: "KM", docHeader: "0031006347" }] },
      { no: "31", itemCode: "", desc: "Sleve Joints", unit: "No.", rate: 25, sapDescription: "SLEEVE JOINTS", sapUom: "NO", sapItems: [] },
      { no: "32", itemCode: "17005052", desc: "H.T.Stay Set", unit: "Set", rate: 400, sapDescription: "MS-HT STAY SET 20 MM", sapUom: "SET", docHeader: "0031006347", sapItems: [{ code: "17005052", desc: "MS-HT STAY SET 20 MM", uom: "SET", docHeader: "0031006347" }] },
      { no: "33", itemCode: "17000239", desc: "G.I.Stay Wire 7/4mm(8 SWG)", unit: "Kg.", rate: 70, sapDescription: "GI STAY WIRE 7/4 MM 8 SWG", sapUom: "KG", docHeader: "0031007012", sapItems: [{ code: "17000239", desc: "GI STAY WIRE 7/4 MM 8 SWG", uom: "KG", docHeader: "0031007012" }] },
      { no: "34", itemCode: "17005053", desc: "Earthing Sets H.T", unit: "Set", rate: 285, sapDescription: "EARTHING SET HT 20 MM X 1.91 MTR", sapUom: "SET", docHeader: "0031006347", sapItems: [{ code: "17005053", desc: "EARTHING SET HT 20 MM X 1.91 MTR", uom: "SET", docHeader: "0031006347" }] },
      { no: "35", itemCode: "17000237", desc: "G.I.Barbed Wire 'A' type.", unit: "Kg.", rate: 65, sapDescription: "GI BARBED WIRE A TYPE", sapUom: "KG", docHeader: "0031006347", sapItems: [{ code: "17000237", desc: "GI BARBED WIRE A TYPE", uom: "KG", docHeader: "0031006347" }] },
      { no: "36", itemCode: "17000751", desc: "Danger Board in yard.", unit: "No.", rate: 10, sapDescription: "DANGER BOARD 11 KV 250X200 MM", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17000751", desc: "DANGER BOARD 11 KV 250X200 MM", uom: "NO", docHeader: "0031006347" }] },
      { no: "37", itemCode: "", desc: "Concreting Cement Bag", unit: "Cmt.", rate: 2700, highlightColor: "#fef08a", sapDescription: "CEMENT GRADE OPC 53", sapUom: "CMT", sapItems: [] },
      { no: "38", itemCode: "17000243", desc: "G.I.Wire 8 SWG/ 6 SWG", unit: "Kg.", rate: 65, sapDescription: "GI WIRE 8 SWG", sapUom: "KG", docHeader: "0031006347", sapItems: [{ code: "17000243", desc: "GI WIRE 8 SWG", uom: "KG", docHeader: "0031006347" }] },
      { no: "39", itemCode: "17000776", desc: "Black Bituminus Paint", unit: "Ltr.", rate: 120, sapDescription: "PAINT BLACK BITUMINUS", sapUom: "L", docHeader: "0031006347", sapItems: [{ code: "17000776", desc: "PAINT BLACK BITUMINUS", uom: "L", docHeader: "0031006347" }] },
      { no: "40", itemCode: "17000778", desc: "Red Oxide Paint for 1 coats", unit: "Ltr.", rate: 140, sapDescription: "RED OXIDE", sapUom: "L", docHeader: "0031007244", sapItems: [{ code: "17000778", desc: "RED OXIDE", uom: "L", docHeader: "0031007244" }] },
      { no: "41", itemCode: "17000775", desc: "Aluminium Paint for 1 coat", unit: "Ltr.", rate: 140, sapDescription: "PAINT ALUMINIUM", sapUom: "L", docHeader: "0031007244", sapItems: [{ code: "17000775", desc: "PAINT ALUMINIUM", uom: "L", docHeader: "0031007244" }] },
      { no: "42", itemCode: "", desc: "Guarding I Boult", unit: "No", rate: 25, highlightColor: "#fef08a", sapDescription: "GUARDING I BOLT", sapUom: "NO", sapItems: [] },
      { no: "43", itemCode: "", desc: "Sundries", unit: "LS", rate: 0, sapDescription: "SUNDRIES", sapUom: "LS", sapItems: [] },
      { no: "", itemCode: "", desc: "Wedge connectors", unit: "", rate: 0, isSection: true },
      { no: "44", itemCode: "17001356", desc: "Wedge connectors RABIT To RABIT or equivalen", unit: "No", rate: 50, sapDescription: "WEDGE CONNECTOR RABBIT TO RABBIT", sapUom: "NO", docHeader: "0031007012", sapItems: [{ code: "17001356", desc: "WEDGE CONNECTOR RABBIT TO RABBIT", uom: "NO", docHeader: "0031007012" }] }
    ]
  },

  "922": {
    title: "Activity 922 Pole Schedule — 11 KV Double Pole (DP) Cut Point Structure on RSJ 116x100, 11 m Pole",
    activityCode: "922",
    materials: [
      { no: "1", itemCode: "17001243", desc: "RSJ 116x100, 11 m long", unit: "No.", rate: 2500, sapDescription: "RSJ POLE 100X116 MM 11 MTR", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17001243", desc: "RSJ POLE 100X116 MM 11 MTR", uom: "NO", docHeader: "0031006347" }] },
      { no: "", itemCode: "", desc: "MS Channel 100x50x6 mm", unit: "Kg.", rate: 0, isSection: true },
      { no: "2", itemCode: "17005040", desc: "Top Channel (DP)", unit: "No.", rate: 250, sapDescription: "MS-TOP CHANNEL-DP-100X50X6X3150-30.1KG", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005040", desc: "MS-TOP CHANNEL-DP-100X50X6X3150-30.1KG", uom: "NO", docHeader: "0031006347" }] },
      { no: "", itemCode: "", desc: "M.S.Channel 75x40x6 mm", unit: "Kg.", rate: 0, isSection: true },
      { no: "3", itemCode: "17005039", desc: "Guarding Cross Arm Channel (DP)", unit: "No.", rate: 350, sapDescription: "MS-GUARD X ARM CH-DP-100X50X3500-33.46KG", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005039", desc: "MS-GUARD X ARM CH-DP-100X50X3500-33.46KG", uom: "NO", docHeader: "0031006347" }] },
      { no: "4", itemCode: "", desc: "Top Cleat (Extension)", unit: "No.", rate: 50, sapDescription: "MS-11KV TOP CLEAT EXTENSION", sapUom: "NO", sapItems: [] },
      { no: "5", itemCode: "17005042", desc: "SPCP Channel", unit: "No", rate: 350, sapDescription: "MS-11KV CUT POINT CH-75X40X6X1310-9.35KG", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005042", desc: "MS-11KV CUT POINT CH-75X40X6X1310-9.35KG", uom: "NO", docHeader: "0031006347" }] },
      { no: "6", itemCode: "17005050", desc: "V-cross With Clamp", unit: "No", rate: 50, sapDescription: "MS-11KV V-CROSS ARM-75X40X6X1614-11.99KG", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005050", desc: "MS-11KV V-CROSS ARM-75X40X6X1614-11.99KG", uom: "NO", docHeader: "0031006347" }] },
      { no: "7", itemCode: "17005041", desc: "Top Cleat With Clamp", unit: "No", rate: 20, sapDescription: "MS-11KV TOP CLEAT-75X40X6X325-2.44KG", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005041", desc: "MS-11KV TOP CLEAT-75X40X6X325-2.44KG", uom: "NO", docHeader: "0031006347" }] },
      { no: "", itemCode: "", desc: "MS angle 50x50x6 mm", unit: "Kg.", rate: 0, isSection: true },
      { no: "8", itemCode: "17005043", desc: "11 KV Bracing for SPCP /Tie", unit: "No.", rate: 150, sapDescription: "MS-11KV CP BRCING ANG-50X50X6X1000-4.5KG", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005043", desc: "MS-11KV CP BRCING ANG-50X50X6X1000-4.5KG", uom: "NO", docHeader: "0031006347" }] },
      { no: "9", itemCode: "17005044", desc: "Belting Angle", unit: "No.", rate: 150, sapDescription: "MS-BELTING ANGLE-DP-50X50X6X1860-8.37KG", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005044", desc: "MS-BELTING ANGLE-DP-50X50X6X1860-8.37KG", uom: "NO", docHeader: "0031006347" }] },
      { no: "10", itemCode: "17005045", desc: "Breasing Angle", unit: "No.", rate: 200, sapDescription: "MS-BRACING ANGLE-DP-50X50X6X3500-15.75KG", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005045", desc: "MS-BRACING ANGLE-DP-50X50X6X3500-15.75KG", uom: "NO", docHeader: "0031006347" }] },
      { no: "11", itemCode: "17005049", desc: "Fish plate", unit: "No.", rate: 30, sapDescription: "MS-FISH PLATE-50X10X254-0.99KG", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005049", desc: "MS-FISH PLATE-50X10X254-0.99KG", uom: "NO", docHeader: "0031006347" }] },
      { no: "", itemCode: "", desc: "M.S. Flats(50 X 10mm)", unit: "Kg.", rate: 0, isSection: true },
      { no: "12", itemCode: "17005046", desc: "Black clamp A type", unit: "No.", rate: 40, sapDescription: "MS-BK CL A TYPE-100X116-50X10X390-1.53KG", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005046", desc: "MS-BK CL A TYPE-100X116-50X10X390-1.53KG", uom: "NO", docHeader: "0031006347" }] },
      { no: "13", itemCode: "17005085", desc: "Black clamp B type", unit: "No.", rate: 40, sapDescription: "MS-BK CL B TYPE-100X116-50X10X400-1.57KG", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005085", desc: "MS-BK CL B TYPE-100X116-50X10X400-1.57KG", uom: "NO", docHeader: "0031006347" }] },
      { no: "14", itemCode: "17005047", desc: "Stay Set clamp A type", unit: "Pair", rate: 50, sapDescription: "MS-STAY CL A TP-100X116-50X10X310-1.21KG", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005047", desc: "MS-STAY CL A TP-100X116-50X10X310-1.21KG", uom: "NO", docHeader: "0031006347" }] },
      { no: "15", itemCode: "17005048", desc: "Stay Set clamp B type", unit: "Pair", rate: 50, sapDescription: "MS-STAY CL B TP-100X116-50X10X310-1.21KG", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005048", desc: "MS-STAY CL B TP-100X116-50X10X310-1.21KG", uom: "NO", docHeader: "0031006347" }] },
      { no: "", itemCode: "", desc: "MS Flat 25x3 mm", unit: "Kg.", rate: 0, isSection: true },
      { no: "16", itemCode: "17001294", desc: "Barbed wire clamp", unit: "Pair", rate: 15, sapDescription: "BARBED WIRE CLAMP 100X116 25X3X320 MM", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17001294", desc: "BARBED WIRE CLAMP 100X116 25X3X320 MM", uom: "NO", docHeader: "0031006347" }] },
      { no: "17", itemCode: "17001300", desc: "Danger Board clamp", unit: "No.", rate: 15, sapDescription: "DANGER BOARD CLAMP 100X116 25X3X465 MM", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17001300", desc: "DANGER BOARD CLAMP 100X116 25X3X465 MM", uom: "NO", docHeader: "0031006347" }] },
      { no: "18", itemCode: "17001397", desc: "11 kV Pin Insulators polymer", unit: "No.", rate: 45, sapDescription: "PIN INSULATOR WITH GI PIN 11KV 5KN POLY", sapUom: "SET", docHeader: "0031007012", sapItems: [{ code: "17001397", desc: "PIN INSULATOR WITH GI PIN 11KV 5KN POLY", uom: "SET", docHeader: "0031007012" }] },
      { no: "19", itemCode: "17000704", desc: "Strain Hardware for Dog0.1 or Equ.AAAC", unit: "No.", rate: 35, sapDescription: "STRAIN HARDWARE FOR ACSR RABBIT B&S TYPE", sapUom: "NO", docHeader: "0031007012", sapItems: [{ code: "17000704", desc: "STRAIN HARDWARE FOR ACSR RABBIT B&S TYPE", uom: "NO", docHeader: "0031007012" }] },
      { no: "20", itemCode: "17000046", desc: "Disc Insulator 11 KV 70 KN Polymer", unit: "No.", rate: 75, highlightColor: "#fef08a", sapDescription: "DISC INSULATOR 11KV 70KN B & S POLYMER", sapUom: "NO", docHeader: "0031007012", sapItems: [{ code: "17000046", desc: "DISC INSULATOR 11KV 70KN B & S POLYMER", uom: "NO", docHeader: "0031007012" }] },
      { no: "21", itemCode: "17005052", desc: "H.T.Stay Set", unit: "No.", rate: 400, sapDescription: "MS-HT STAY SET 20 MM", sapUom: "SET", docHeader: "0031006347", sapItems: [{ code: "17005052", desc: "MS-HT STAY SET 20 MM", uom: "SET", docHeader: "0031006347" }] },
      { no: "22", itemCode: "17000239", desc: "G.I.Stay Wire 7/4mm(8 SWG)", unit: "Kg.", rate: 70, highlightColor: "#fef08a", sapDescription: "GI STAY WIRE 7/4 MM 8 SWG", sapUom: "KG", docHeader: "0031007012", sapItems: [{ code: "17000239", desc: "GI STAY WIRE 7/4 MM 8 SWG", uom: "KG", docHeader: "0031007012" }] },
      { no: "23", itemCode: "17005053", desc: "Earthing Sets H.T", unit: "No.", rate: 285, highlightColor: "#fef08a", sapDescription: "EARTHING SET HT 20 MM X 1.91 MTR", sapUom: "SET", docHeader: "0031006347", sapItems: [{ code: "17005053", desc: "EARTHING SET HT 20 MM X 1.91 MTR", uom: "SET", docHeader: "0031006347" }] },
      { no: "24", itemCode: "17000243", desc: "G.I.Wire 8 SWG/ 6 SWG", unit: "kg.", rate: 65, highlightColor: "#fef08a", sapDescription: "GI WIRE 8 SWG", sapUom: "KG", docHeader: "0031006347", sapItems: [{ code: "17000243", desc: "GI WIRE 8 SWG", uom: "KG", docHeader: "0031006347" }] },
      { no: "25", itemCode: "17000237", desc: "G.I.Barbed Wire 'A' type.", unit: "kg.", rate: 65, highlightColor: "#fef08a", sapDescription: "GI BARBED WIRE A TYPE", sapUom: "KG", docHeader: "0031006347", sapItems: [{ code: "17000237", desc: "GI BARBED WIRE A TYPE", uom: "KG", docHeader: "0031006347" }] },
      { no: "26", itemCode: "17000751", desc: "Danger Board in yard.", unit: "No.", rate: 10, highlightColor: "#fef08a", sapDescription: "DANGER BOARD 11 KV 250X200 MM", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17000751", desc: "DANGER BOARD 11 KV 250X200 MM", uom: "NO", docHeader: "0031006347" }] },
      { no: "27", itemCode: "17000776", desc: "Black Bituminus Paint", unit: "Ltr.", rate: 120, sapDescription: "PAINT BLACK BITUMINUS", sapUom: "L", docHeader: "0031006347", sapItems: [{ code: "17000776", desc: "PAINT BLACK BITUMINUS", uom: "L", docHeader: "0031006347" }] },
      { no: "28", itemCode: "17000778", desc: "Red Oxide Paint for 2 coats", unit: "Ltr.", rate: 140, sapDescription: "RED OXIDE", sapUom: "L", docHeader: "0031007244", sapItems: [{ code: "17000778", desc: "RED OXIDE", uom: "L", docHeader: "0031007244" }] },
      { no: "29", itemCode: "17000775", desc: "Aluminium Paint for 1 coat", unit: "Ltr.", rate: 140, sapDescription: "PAINT ALUMINIUM", sapUom: "L", docHeader: "0031007244", sapItems: [{ code: "17000775", desc: "PAINT ALUMINIUM", uom: "L", docHeader: "0031007244" }] },
      { no: "30", itemCode: "", desc: "Concreting ration 1:3:6", unit: "Cmt.", rate: 2700, highlightColor: "#fef08a", sapDescription: "CEMENT GRADE OPC 53", sapUom: "CMT", sapItems: [] },
      { no: "", itemCode: "", desc: "G.I.Nut Bolts", unit: "Kg", rate: 85, isSection: true },
      { no: "31", itemCode: "17000636", desc: "N/B 16*150 (6 Inch)", unit: "No", rate: 35, highlightColor: "#fef08a", sapDescription: "HDG BOLT HT M16X150 NUT 1 SPRG 1 PL WSHR", sapUom: "SET", docHeader: "0031006347", sapItems: [{ code: "17000636", desc: "HDG BOLT HT M16X150 NUT 1 SPRG 1 PL WSHR", uom: "SET", docHeader: "0031006347" }] },
      { no: "32", itemCode: "17000625", desc: "N/B 16*75 (3 Inch)", unit: "No", rate: 25, highlightColor: "#fef08a", sapDescription: "HDG BOLT FT M16X75 NUT 1 SPRG 1 PL WSHR", sapUom: "SET", docHeader: "0031006347", sapItems: [{ code: "17000625", desc: "HDG BOLT FT M16X75 NUT 1 SPRG 1 PL WSHR", uom: "SET", docHeader: "0031006347" }] },
      { no: "33", itemCode: "", desc: "N/B 16*50 (2 Inch)", unit: "No", rate: 20, highlightColor: "#fef08a", sapDescription: "HDG BOLT FT M16X50", sapUom: "SET", sapItems: [] },
      { no: "34", itemCode: "17000620", desc: "N/B 16*35 (1 1/2 Inch)", unit: "No", rate: 15, highlightColor: "#fef08a", sapDescription: "HDG BOLT FT M16X35 NUT 1 SPRG 1 PL WSHR", sapUom: "SET", docHeader: "0031006347", sapItems: [{ code: "17000620", desc: "HDG BOLT FT M16X35 NUT 1 SPRG 1 PL WSHR", uom: "SET", docHeader: "0031006347" }] },
      { no: "35", itemCode: "17000627", desc: "N/B 6*50 (2 Inch)", unit: "No", rate: 10, highlightColor: "#fef08a", sapDescription: "HDG BOLT FT M8X50 NUT 1 SPRG 1 PL WSHR", sapUom: "SET", docHeader: "0031006347", sapItems: [{ code: "17000627", desc: "HDG BOLT FT M8X50 NUT 1 SPRG 1 PL WSHR", uom: "SET", docHeader: "0031006347" }] },
      { no: "36", itemCode: "17000004", desc: "RSJ 116*100 09m Pole", unit: "No.", rate: 2100, isExtra: true, sapDescription: "RSJ POLE 100X116 MM 9 MTR", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17000004", desc: "RSJ POLE 100X116 MM 9 MTR", uom: "NO", docHeader: "0031006347" }] },
      { no: "37", itemCode: "17005037", desc: "RSJ 116*100 08m Pole", unit: "No.", rate: 1500, isExtra: true, sapDescription: "RSJ POLE 100X116 MM 8 MTR", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17005037", desc: "RSJ POLE 100X116 MM 8 MTR", uom: "NO", docHeader: "0031006347" }] },
      { no: "38", itemCode: "17001356", desc: "Wedge Connector", unit: "No.", rate: 50, isExtra: true, sapDescription: "WEDGE CONNECTOR RABBIT TO RABBIT", sapUom: "NO", docHeader: "0031007012", sapItems: [{ code: "17001356", desc: "WEDGE CONNECTOR RABBIT TO RABBIT", uom: "NO", docHeader: "0031007012" }] },
      { no: "39", itemCode: "17000651", desc: "Lugs 70sqmm", unit: "No.", rate: 15, isExtra: true, highlightColor: "#fecdd3", sapDescription: "LUG AL RING 70 SQMM", sapUom: "NO", docHeader: "0031006347", sapItems: [{ code: "17000651", desc: "LUG AL RING 70 SQMM", uom: "NO", docHeader: "0031006347" }] }
    ]
  },
  "1425A": {
    "title": "Activity 1425A Pole Schedule — 3 Phase 5 Wire LT Line with AAAC 55 sqmm & ACSR Weasel on PSC Pole 8 Mtr (140 KG)",
    "activityCode": "1425A",
    "materials": [
        {
            "no": "",
            "itemCode": "",
            "desc": "Span",
            "unit": "",
            "rate": 0,
            "isSpan": true
        },
        {
            "no": "1",
            "itemCode": "17001240",
            "desc": "PSC Pole 8 Mtr (140 KG)",
            "unit": "No",
            "rate": 1000,
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
            "itemCode": "17001261",
            "desc": "AAAC 55 mm2",
            "unit": "Rmt",
            "rate": 3,
            "highlightColor": "#fef08a",
            "sapDescription": "AAAC RABBIT CONDUCTOR",
            "sapUom": "KM",
            "docHeader": "0031006347",
            "sapItems": [
                {
                    "code": "17001261",
                    "desc": "AAAC RABBIT CONDUCTOR",
                    "uom": "KM",
                    "docHeader": "0031006347"
                }
            ]
        },
        {
            "no": "3",
            "itemCode": "17000120",
            "desc": "ACSR Weasel",
            "unit": "Rmt",
            "rate": 2,
            "highlightColor": "#fef08a",
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
            "no": "",
            "itemCode": "",
            "desc": "MS angle 50x50x6 mm",
            "unit": "Kg",
            "rate": 0,
            "isSection": true
        },
        {
            "no": "4",
            "itemCode": "17005078",
            "desc": "LT Vertical Angle 5-Pin",
            "unit": "No",
            "rate": 120,
            "sapDescription": "MS-LT 4 PIN ANGLE-50X50X6X1220-5.49KG",
            "sapUom": "NO",
            "docHeader": "0031006347",
            "sapItems": [
                {
                    "code": "17005078",
                    "desc": "MS-LT 4 PIN ANGLE-50X50X6X1220-5.49KG",
                    "uom": "NO",
                    "docHeader": "0031006347"
                }
            ]
        },
        {
            "no": "5",
            "itemCode": "17005078",
            "desc": "LT Vertical Angle 4-Pin",
            "unit": "No",
            "rate": 100,
            "sapDescription": "MS-LT 4 PIN ANGLE-50X50X6X1220-5.49KG",
            "sapUom": "NO",
            "docHeader": "0031006347",
            "sapItems": [
                {
                    "code": "17005078",
                    "desc": "MS-LT 4 PIN ANGLE-50X50X6X1220-5.49KG",
                    "uom": "NO",
                    "docHeader": "0031006347"
                }
            ]
        },
        {
            "no": "6",
            "itemCode": "17005077",
            "desc": "LT Guarding Cross Arm (2 Pin)",
            "unit": "No",
            "rate": 80,
            "sapDescription": "MS-LT 2 PIN ANGLE-50X50X6X610-2.75KG",
            "sapUom": "NO",
            "docHeader": "0031006347",
            "sapItems": [
                {
                    "code": "17005077",
                    "desc": "MS-LT 2 PIN ANGLE-50X50X6X610-2.75KG",
                    "uom": "NO",
                    "docHeader": "0031006347"
                }
            ]
        },
        {
            "no": "",
            "itemCode": "",
            "desc": "M.S. Flats (50 X 6mm)",
            "unit": "Kg",
            "rate": 0,
            "isSection": true
        },
        {
            "no": "7",
            "itemCode": "17005082",
            "desc": "D-Clamp",
            "unit": "No.",
            "rate": 25,
            "sapDescription": "MS-U CL FOR SHACKLE INS-50X6X342-0.807KG",
            "sapUom": "NO",
            "docHeader": "0031006347",
            "sapItems": [
                {
                    "code": "17005082",
                    "desc": "MS-U CL FOR SHACKLE INS-50X6X342-0.807KG",
                    "uom": "NO",
                    "docHeader": "0031006347"
                }
            ]
        },
        {
            "no": "8",
            "itemCode": "",
            "desc": "PSC Stay Clamp A Type (Top)",
            "unit": "Pair",
            "rate": 45,
            "sapDescription": "PSC STAY CLAMP A TYPE TOP",
            "sapUom": "PAIR",
            "sapItems": []
        },
        {
            "no": "9",
            "itemCode": "",
            "desc": "PSC Stay Clamp B Type (Top)",
            "unit": "Pair",
            "rate": 45,
            "sapDescription": "PSC STAY CLAMP B TYPE TOP",
            "sapUom": "PAIR",
            "sapItems": []
        },
        {
            "no": "10",
            "itemCode": "",
            "desc": "PSC Stay Clamp A Type (Bottom)",
            "unit": "Pair",
            "rate": 45,
            "sapDescription": "PSC STAY CLAMP A TYPE BOTTOM",
            "sapUom": "PAIR",
            "sapItems": []
        },
        {
            "no": "11",
            "itemCode": "",
            "desc": "PSC Stay Clamp B Type (Bottom)",
            "unit": "Pair",
            "rate": 45,
            "sapDescription": "PSC STAY CLAMP B TYPE BOTTOM",
            "sapUom": "PAIR",
            "sapItems": []
        },
        {
            "no": "12",
            "itemCode": "",
            "desc": "PSC Side Clamp A Type (Top)",
            "unit": "No",
            "rate": 30,
            "sapDescription": "PSC SIDE CLAMP A TYPE TOP",
            "sapUom": "NO",
            "sapItems": []
        },
        {
            "no": "13",
            "itemCode": "",
            "desc": "PSC Side Clamp B Type (Top)",
            "unit": "No",
            "rate": 30,
            "sapDescription": "PSC SIDE CLAMP B TYPE TOP",
            "sapUom": "NO",
            "sapItems": []
        },
        {
            "no": "14",
            "itemCode": "",
            "desc": "PSC Side Clamp A Type (Bottom)",
            "unit": "No",
            "rate": 30,
            "sapDescription": "PSC SIDE CLAMP A TYPE BOTTOM",
            "sapUom": "NO",
            "sapItems": []
        },
        {
            "no": "15",
            "itemCode": "",
            "desc": "PSC Side Clamp B Type (Bottom)",
            "unit": "No",
            "rate": 30,
            "sapDescription": "PSC SIDE CLAMP B TYPE BOTTOM",
            "sapUom": "NO",
            "sapItems": []
        },
        {
            "no": "16",
            "itemCode": "17000056",
            "desc": "L.T.Shackle Insulator",
            "unit": "No",
            "rate": 6,
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
            "no": "17",
            "itemCode": "17001150",
            "desc": "Aluminium Bobbins for neutral",
            "unit": "No.",
            "rate": 2,
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
            "no": "18",
            "itemCode": "17000696",
            "desc": "L.T.Shackle hardware",
            "unit": "Pair",
            "rate": 3,
            "sapDescription": "LT SHACKLE HARDWARE",
            "sapUom": "PAIR",
            "docHeader": "0031006347",
            "sapItems": [
                {
                    "code": "17000696",
                    "desc": "LT SHACKLE HARDWARE",
                    "uom": "PAIR",
                    "docHeader": "0031006347"
                }
            ]
        },
        {
            "no": "19",
            "itemCode": "",
            "desc": "Jointing Sleeves for AAC",
            "unit": "No",
            "rate": 5,
            "sapDescription": "JOINTING SLEEVES FOR AAC",
            "sapUom": "NO",
            "sapItems": []
        },
        {
            "no": "20",
            "itemCode": "",
            "desc": "PG Clamp",
            "unit": "No",
            "rate": 8,
            "sapDescription": "PG CLAMP",
            "sapUom": "NO",
            "sapItems": []
        },
        {
            "no": "21",
            "itemCode": "17001369",
            "desc": "Earthing Sets L.T.",
            "unit": "Set",
            "rate": 285,
            "sapDescription": "EARTHING SET LT",
            "sapUom": "SET",
            "docHeader": "0031006347",
            "sapItems": [
                {
                    "code": "17001369",
                    "desc": "EARTHING SET LT",
                    "uom": "SET",
                    "docHeader": "0031006347"
                }
            ]
        },
        {
            "no": "22",
            "itemCode": "17005091",
            "desc": "L.T. Stay sets",
            "unit": "Set",
            "rate": 400,
            "sapDescription": "MS-LT STAY SET 16 MM",
            "sapUom": "SET",
            "docHeader": "0031006347",
            "sapItems": [
                {
                    "code": "17005091",
                    "desc": "MS-LT STAY SET 16 MM",
                    "uom": "SET",
                    "docHeader": "0031006347"
                }
            ]
        },
        {
            "no": "23",
            "itemCode": "17000238",
            "desc": "G.I.Stay Wire 7/3.15mm(10SWG)",
            "unit": "Kg.",
            "rate": 8,
            "highlightColor": "#fef08a",
            "sapDescription": "GI STAY WIRE 7/3.15 MM 10 SWG",
            "sapUom": "KG",
            "docHeader": "0031006347",
            "sapItems": [
                {
                    "code": "17000238",
                    "desc": "GI STAY WIRE 7/3.15 MM 10 SWG",
                    "uom": "KG",
                    "docHeader": "0031006347"
                }
            ]
        },
        {
            "no": "24",
            "itemCode": "17000058",
            "desc": "Stay Insulators",
            "unit": "No",
            "rate": 4,
            "highlightColor": "#fef08a",
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
            "no": "25",
            "itemCode": "",
            "desc": "Binding Wire",
            "unit": "Kg",
            "rate": 2.5,
            "sapDescription": "BINDING WIRE",
            "sapUom": "KG",
            "sapItems": []
        },
        {
            "no": "26",
            "itemCode": "",
            "desc": "Binding Tape",
            "unit": "Kg",
            "rate": 2.5,
            "sapDescription": "BINDING TAPE",
            "sapUom": "KG",
            "sapItems": []
        },
        {
            "no": "27",
            "itemCode": "17000243",
            "desc": "G.I.Wire 8 SWG/ 6 SWG",
            "unit": "Kg.",
            "rate": 4,
            "highlightColor": "#fef08a",
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
            "no": "28",
            "itemCode": "",
            "desc": "Red Oxide Paint for 2 coats",
            "unit": "Ltr",
            "rate": 140,
            "sapDescription": "RED OXIDE PAINT",
            "sapUom": "L",
            "sapItems": []
        },
        {
            "no": "29",
            "itemCode": "17000057",
            "desc": "L.T.Spacers",
            "unit": "No",
            "rate": 12,
            "sapDescription": "LT SPACER",
            "sapUom": "NO",
            "docHeader": "0031006347",
            "sapItems": [
                {
                    "code": "17000057",
                    "desc": "LT SPACER",
                    "uom": "NO",
                    "docHeader": "0031006347"
                }
            ]
        },
        {
            "no": "",
            "itemCode": "",
            "desc": "G.I.Nut Bolts",
            "unit": "Kg",
            "rate": 0,
            "isSection": true
        },
        {
            "no": "30",
            "itemCode": "17000614",
            "desc": "N/B 12*35 (1.5 Inch)",
            "unit": "No",
            "rate": 12,
            "highlightColor": "#fef08a",
            "sapDescription": "HDG BOLT FT M12X35 NUT 1 SPRG 1 PL WSHR",
            "sapUom": "SET",
            "docHeader": "0031006347",
            "sapItems": [
                {
                    "code": "17000614",
                    "desc": "HDG BOLT FT M12X35 NUT 1 SPRG 1 PL WSHR",
                    "uom": "SET",
                    "docHeader": "0031006347"
                }
            ]
        },
        {
            "no": "31",
            "itemCode": "17000617",
            "desc": "N/B 12*65 (3 Inch)",
            "unit": "No",
            "rate": 15,
            "highlightColor": "#fef08a",
            "sapDescription": "HDG BOLT FT M12X65 NUT 1 SPRG 1 PL WSHR",
            "sapUom": "SET",
            "docHeader": "0031006347",
            "sapItems": [
                {
                    "code": "17000617",
                    "desc": "HDG BOLT FT M12X65 NUT 1 SPRG 1 PL WSHR",
                    "uom": "SET",
                    "docHeader": "0031006347"
                }
            ]
        },
        {
            "no": "32",
            "itemCode": "17000613",
            "desc": "N/B 12*150 (6 Inch)",
            "unit": "No",
            "rate": 22,
            "highlightColor": "#fef08a",
            "sapDescription": "HDG BOLT FT M12X150 NUT 1 SPRG 1 PL WSHR",
            "sapUom": "SET",
            "docHeader": "0031006347",
            "sapItems": [
                {
                    "code": "17000613",
                    "desc": "HDG BOLT FT M12X150 NUT 1 SPRG 1 PL WSHR",
                    "uom": "SET",
                    "docHeader": "0031006347"
                }
            ]
        },
        {
            "no": "33",
            "itemCode": "17000632",
            "desc": "N/B 12*175 (7 Inch)",
            "unit": "No",
            "rate": 25,
            "highlightColor": "#fef08a",
            "sapDescription": "HDG BOLT HT M12X175 NUT 1 SPRG 1 PL WSHR",
            "sapUom": "SET",
            "docHeader": "0031006347",
            "sapItems": [
                {
                    "code": "17000632",
                    "desc": "HDG BOLT HT M12X175 NUT 1 SPRG 1 PL WSHR",
                    "uom": "SET",
                    "docHeader": "0031006347"
                }
            ]
        },
        {
            "no": "34",
            "itemCode": "17005513",
            "desc": "N/B 12*190 (9 Inch)",
            "unit": "No",
            "rate": 28,
            "highlightColor": "#fef08a",
            "sapDescription": "HDG BOLT HT M12X225 NUT 1 SPRG 1 PL WSHR",
            "sapUom": "SET",
            "docHeader": "0031006347",
            "sapItems": [
                {
                    "code": "17005513",
                    "desc": "HDG BOLT HT M12X225 NUT 1 SPRG 1 PL WSHR",
                    "uom": "SET",
                    "docHeader": "0031006347"
                }
            ]
        },
        {
            "no": "35",
            "itemCode": "17001356",
            "desc": "Wedge connectors",
            "unit": "No",
            "rate": 50,
            "sapDescription": "WEDGE CONNECTOR RABBIT TO RABBIT",
            "sapUom": "NO",
            "docHeader": "0031007012",
            "sapItems": [
                {
                    "code": "17001356",
                    "desc": "WEDGE CONNECTOR RABBIT TO RABBIT",
                    "uom": "NO",
                    "docHeader": "0031007012"
                }
            ]
        },
        {
            "no": "36",
            "itemCode": "",
            "desc": "Sundries",
            "unit": "LS",
            "rate": 0,
            "highlightColor": "#fef08a",
            "sapDescription": "SUNDRIES",
            "sapUom": "LS",
            "sapItems": []
        },
        {
            "no": "37",
            "itemCode": "",
            "desc": "Concreting ration 1:3:6",
            "unit": "L.S.",
            "rate": 2700,
            "highlightColor": "#fef08a",
            "sapDescription": "CONCRETING",
            "sapUom": "LS",
            "sapItems": []
        }
    ]
}
};


defaultPoleSchedules["1220"] = {
  "title": "Activity 1220 Pole Schedule — 100 KVA Dist. Transformer Center on RSJ 116x100, 11m Pole",
  "activityCode": "1220",
  "materials": [
    {
      "no": "1",
      "itemCode": "17000081",
      "desc": "Dist. Transformer 100 KVA, 11/0.43 kv",
      "unit": "No.",
      "rate": 125000,
      "sapDescription": "DIST BOX WITH KITKAT FOR 100 KVA DTC",
      "sapUom": "NO",
      "docHeader": "0031006347",
      "sapItems": [
        {
          "code": "17000081",
          "desc": "DIST BOX WITH KITKAT FOR 100 KVA DTC",
          "uom": "NO",
          "docHeader": "0031006347"
        }
      ]
    },
    {
      "no": "2",
      "itemCode": "17001243",
      "desc": "RSJ 116x100, 11 m long",
      "unit": "No",
      "rate": 2500,
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
      "itemCode": "17002007",
      "desc": "MS Channel 100x50x6 mm",
      "unit": "Kg.",
      "rate": 80,
      "sapDescription": "MS CHANNEL 100X50X6 MM",
      "sapUom": "MT",
      "docHeader": "0031006347",
      "sapItems": [
        {
          "code": "17002007",
          "desc": "MS CHANNEL 100X50X6 MM",
          "uom": "MT",
          "docHeader": "0031006347"
        }
      ]
    },
    {
      "no": "4",
      "itemCode": "17001391",
      "desc": "M.S.Channel 75x40x6 mm",
      "unit": "kg.",
      "rate": 80,
      "sapDescription": "MS CHANNEL 75X40X6 MM",
      "sapUom": "MT",
      "docHeader": "0031006347",
      "sapItems": [
        {
          "code": "17001391",
          "desc": "MS CHANNEL 75X40X6 MM",
          "uom": "MT",
          "docHeader": "0031006347"
        }
      ]
    },
    {
      "no": "5",
      "itemCode": "17001315",
      "desc": "MS angle 50x50x6 mm",
      "unit": "kg.",
      "rate": 80,
      "sapDescription": "SUPPORT ANGLE FOR AB SW 50X50X6X500 MM",
      "sapUom": "NO",
      "docHeader": "0031006347",
      "sapItems": [
        {
          "code": "17001315",
          "desc": "SUPPORT ANGLE FOR AB SW 50X50X6X500 MM",
          "uom": "NO",
          "docHeader": "0031006347"
        }
      ]
    },
    {
      "no": "6",
      "itemCode": "17001393",
      "desc": "M.S.Flat 50 x 10mm",
      "unit": "kg.",
      "rate": 80,
      "sapDescription": "MS FLAT 50X10 MM",
      "sapUom": "MT",
      "docHeader": "0031006347",
      "sapItems": [
        {
          "code": "17001393",
          "desc": "MS FLAT 50X10 MM",
          "uom": "MT",
          "docHeader": "0031006347"
        }
      ]
    },
    {
      "no": "7",
      "itemCode": "17001397",
      "desc": "11 kV Pin Insulators with G.I. Pins",
      "unit": "NO.",
      "rate": 45,
      "sapDescription": "PIN INSULATOR WITH GI PIN 11KV 5KN POLY",
      "sapUom": "SET",
      "docHeader": "0031007012",
      "sapItems": [
        {
          "code": "17001397",
          "desc": "PIN INSULATOR WITH GI PIN 11KV 5KN POLY",
          "uom": "SET",
          "docHeader": "0031007012"
        }
      ]
    },
    {
      "no": "8",
      "itemCode": "17000702",
      "desc": "Strain Hardware for Dog0.1 or Equ.AAAC.",
      "unit": "No.",
      "rate": 40,
      "sapDescription": "STRAIN HARDWARE FOR ACSR DOG B&S TYPE",
      "sapUom": "SET",
      "docHeader": "0031007012",
      "sapItems": [
        {
          "code": "17000702",
          "desc": "STRAIN HARDWARE FOR ACSR DOG B&S TYPE",
          "uom": "SET",
          "docHeader": "0031007012"
        }
      ]
    },
    {
      "no": "9",
      "itemCode": "17000081",
      "desc": "L.T.Dist.Boxes 100 KVA with MCCB",
      "unit": "No.",
      "rate": 8500,
      "sapDescription": "DIST BOX WITH KITKAT FOR 100 KVA DTC",
      "sapUom": "NO",
      "docHeader": "0031006347",
      "sapItems": [
        {
          "code": "17000081",
          "desc": "DIST BOX WITH KITKAT FOR 100 KVA DTC",
          "uom": "NO",
          "docHeader": "0031006347"
        }
      ]
    },
    {
      "no": "10",
      "itemCode": "17000128",
      "desc": "L.As. 11 KV (Gapless type) with disconector",
      "unit": "No.",
      "rate": 450,
      "sapDescription": "LA 11 KV GAPLESS WITH DISCONNECTOR",
      "sapUom": "NO",
      "docHeader": "0031006347",
      "sapItems": [
        {
          "code": "17000128",
          "desc": "LA 11 KV GAPLESS WITH DISCONNECTOR",
          "uom": "NO",
          "docHeader": "0031006347"
        }
      ]
    },
    {
      "no": "11",
      "itemCode": "17005052",
      "desc": "H.T.Stay Set",
      "unit": "No.",
      "rate": 400,
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
      "no": "12",
      "itemCode": "17000239",
      "desc": "G.I.Stay Wire 7/4mm(8 SWG)",
      "unit": "kg.",
      "rate": 70,
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
      "no": "13",
      "itemCode": "17005053",
      "desc": "Earthing Sets H.T",
      "unit": "No.",
      "rate": 285,
      "sapDescription": "EARTHING SET HT 20 MM X 1.91 MTR",
      "sapUom": "SET",
      "docHeader": "0031006347",
      "sapItems": [
        {
          "code": "17005053",
          "desc": "EARTHING SET HT 20 MM X 1.91 MTR",
          "uom": "SET",
          "docHeader": "0031006347"
        }
      ]
    },
    {
      "no": "14",
      "itemCode": "17000026",
      "desc": "11KV H.G.Fuses",
      "unit": "Set",
      "rate": 650,
      "sapDescription": "11 KV HG FUSE SET",
      "sapUom": "SET",
      "docHeader": "0031006347",
      "sapItems": [
        {
          "code": "17000026",
          "desc": "11 KV HG FUSE SET",
          "uom": "SET",
          "docHeader": "0031006347"
        }
      ]
    },
    {
      "no": "15",
      "itemCode": "17000023",
      "desc": "11KV A.B. Switch",
      "unit": "Set.",
      "rate": 3500,
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
      "no": "16",
      "itemCode": "17000751",
      "desc": "Danger Board in yard.",
      "unit": "No.",
      "rate": 10,
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
      "itemCode": "17000243",
      "desc": "G.I.Wire 8 SWG/ 6 SWG",
      "unit": "Kg.",
      "rate": 65,
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
      "itemCode": "17000237",
      "desc": "G.I.Barbed Wire 'A' type.",
      "unit": "kg.",
      "rate": 65,
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
      "no": "19",
      "itemCode": "11000336",
      "desc": "Concreting ration 1:4:8",
      "unit": "CMT.",
      "rate": 2500,
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
      "no": "20",
      "itemCode": "",
      "desc": "Painting/Hardware & support with numbering of pole",
      "unit": "L.S.",
      "rate": 500,
      "sapDescription": "PAINTING & HARDWARE",
      "sapUom": "LS",
      "sapItems": []
    },
    {
      "no": "21",
      "itemCode": "",
      "desc": "Sundries",
      "unit": "L.S.",
      "rate": 0,
      "sapDescription": "SUNDRIES",
      "sapUom": "LS",
      "sapItems": []
    },
    {
      "no": "22",
      "itemCode": "17000108",
      "desc": "DTC Metring with Box, single core L.T. XLPE cable (70 sq.mm., 1...",
      "unit": "No",
      "rate": 4500,
      "sapDescription": "LT CT METER BOX FOR 100 KVA DTC",
      "sapUom": "NO",
      "docHeader": "0031006347",
      "sapItems": [
        {
          "code": "17000108",
          "desc": "LT CT METER BOX FOR 100 KVA DTC",
          "uom": "NO",
          "docHeader": "0031006347"
        }
      ]
    },
    {
      "no": "23",
      "itemCode": "",
      "desc": "Single core L.T. XLPE 120 sqmm cable 32 mtr length and other allie...",
      "unit": "mtr",
      "rate": 180,
      "isExtra": true,
      "sapDescription": "CABLE AL 11KV XLPE",
      "sapUom": "MTR",
      "docHeader": "0031006347",
      "sapItems": [
        {
          "code": "",
          "desc": "CABLE AL 11KV XLPE",
          "uom": "MTR",
          "docHeader": "0031006347"
        }
      ]
    },
    {
      "no": "24",
      "itemCode": "17000194",
      "desc": "Single core L.T. XLPE 70 sqmm cable 22 mtr length and other allie...",
      "unit": "mtr",
      "rate": 120,
      "isExtra": true,
      "sapDescription": "CABLE AL 1.1KV XLPE 70 SQMM",
      "sapUom": "MTR",
      "docHeader": "0031006347",
      "sapItems": [
        {
          "code": "17000194",
          "desc": "CABLE AL 1.1KV XLPE 70 SQMM",
          "uom": "MTR",
          "docHeader": "0031006347"
        }
      ]
    },
    {
      "no": "25",
      "itemCode": "17005508",
      "desc": "100/5 A CT Operated meter (3 phase)",
      "unit": "No",
      "rate": 3500,
      "isExtra": true,
      "sapDescription": "ENERGY METER LT CT 100/5 AMP",
      "sapUom": "NO",
      "docHeader": "0031006347",
      "sapItems": [
        {
          "code": "17005508",
          "desc": "ENERGY METER LT CT 100/5 AMP",
          "uom": "NO",
          "docHeader": "0031006347"
        }
      ]
    },
    {
      "no": "26",
      "itemCode": "17000108",
      "desc": "SMC Three phase AMR meter box (Without Modem)",
      "unit": "No",
      "rate": 1800,
      "isExtra": true,
      "sapDescription": "LT CT METER BOX FOR 100 KVA DTC",
      "sapUom": "NO",
      "docHeader": "0031006347",
      "sapItems": [
        {
          "code": "17000108",
          "desc": "LT CT METER BOX FOR 100 KVA DTC",
          "uom": "NO",
          "docHeader": "0031006347"
        }
      ]
    },
    {
      "no": "27",
      "itemCode": "17001264",
      "desc": "LT CT 200/5 Amp",
      "unit": "No",
      "rate": 450,
      "isExtra": true,
      "sapDescription": "CT LT RING TYPE 200/5A",
      "sapUom": "NO",
      "docHeader": "0031006347",
      "sapItems": [
        {
          "code": "17001264",
          "desc": "CT LT RING TYPE 200/5A",
          "uom": "NO",
          "docHeader": "0031006347"
        }
      ]
    },
    {
      "no": "28",
      "itemCode": "17001394",
      "desc": "MS Flat 25x3 mm",
      "unit": "Kg.",
      "rate": 80,
      "isExtra": true,
      "sapDescription": "MS FLAT 25X3 MM",
      "sapUom": "MT",
      "docHeader": "0031006347",
      "sapItems": [
        {
          "code": "17001394",
          "desc": "MS FLAT 25X3 MM",
          "uom": "MT",
          "docHeader": "0031006347"
        }
      ]
    },
    {
      "no": "29",
      "itemCode": "17000046",
      "desc": "11 KV Disc Insulator 70KN B& S Polymer",
      "unit": "No.",
      "rate": 75,
      "isExtra": true,
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
      "no": "",
      "itemCode": "",
      "desc": "Weight For M.S.Channel 100x50x6 mm:",
      "unit": "Unit",
      "rate": 0,
      "isSection": true
    },
    {
      "no": "30",
      "itemCode": "17005060",
      "desc": "Transformer Base Channel",
      "unit": "Nos",
      "rate": 550,
      "sapDescription": "TRANSFORMER BASE CHANNEL 100X50X6 MM",
      "sapUom": "NO",
      "sapItems": []
    },
    {
      "no": "31",
      "itemCode": "17005059",
      "desc": "Transformer Top Channel",
      "unit": "Nos",
      "rate": 450,
      "sapDescription": "TRANSFORMER TOP CHANNEL 100X50X6 MM",
      "sapUom": "NO",
      "sapItems": []
    },
    {
      "no": "",
      "itemCode": "",
      "desc": "Total M.S.Channel 100x50x6 mm",
      "unit": "Kg.",
      "rate": 0,
      "isSubtotal": true
    },
    {
      "no": "",
      "itemCode": "",
      "desc": "Weight For M.S.Channel 75x40x6 mm:",
      "unit": "Unit",
      "rate": 0,
      "isSection": true
    },
    {
      "no": "32",
      "itemCode": "17005061",
      "desc": "AB Switch/ HG Fuse Channel",
      "unit": "Nos",
      "rate": 400,
      "sapDescription": "MS-AB SWITCH MTG CH-75X40X6X2700-19.28KG",
      "sapUom": "NO",
      "sapItems": []
    },
    {
      "no": "33",
      "itemCode": "",
      "desc": "Channel for AB Opreating Handle",
      "unit": "Nos",
      "rate": 200,
      "sapDescription": "CHANNEL FOR AB OPERATING HANDLE",
      "sapUom": "NO",
      "sapItems": []
    },
    {
      "no": "34",
      "itemCode": "17005050",
      "desc": "Channel for 11 KV V-Cross Arm",
      "unit": "Nos",
      "rate": 350,
      "sapDescription": "MS-11KV V-CROSS ARM-75X40X6X1614-11.99KG",
      "sapUom": "NO",
      "sapItems": []
    },
    {
      "no": "35",
      "itemCode": "17005041",
      "desc": "Top Cleat SPCP",
      "unit": "Nos",
      "rate": 35,
      "sapDescription": "MS-11KV TOP CLEAT-75X40X6X325-2.44KG",
      "sapUom": "NO",
      "sapItems": []
    },
    {
      "no": "36",
      "itemCode": "17005040",
      "desc": "Top Channel SPCP",
      "unit": "Nos",
      "rate": 450,
      "sapDescription": "MS-TOP CHANNEL-DP-100X50X6X3150-30.1KG",
      "sapUom": "NO",
      "sapItems": []
    },
    {
      "no": "37",
      "itemCode": "17005042",
      "desc": "Bottom Channel SPCP",
      "unit": "Nos",
      "rate": 450,
      "sapDescription": "MS-11KV CUT POINT CH-75X40X6X1310-9.35KG",
      "sapUom": "NO",
      "sapItems": []
    },
    {
      "no": "38",
      "itemCode": "17004792",
      "desc": "Guarding Channel",
      "unit": "Nos",
      "rate": 500,
      "sapDescription": "11KV GUARDING CHANNEL 75X40X2210-15.78KG",
      "sapUom": "SET",
      "sapItems": []
    },
    {
      "no": "",
      "itemCode": "",
      "desc": "Total M.S.Channel 75x40x6 mm",
      "unit": "Kg.",
      "rate": 0,
      "isSubtotal": true
    },
    {
      "no": "",
      "itemCode": "",
      "desc": "Weight For Angle (50x50x6) :",
      "unit": "Unit",
      "rate": 0,
      "isSection": true
    },
    {
      "no": "39",
      "itemCode": "17005044",
      "desc": "Transformer Belting Angle (Long)",
      "unit": "Nos",
      "rate": 150,
      "sapDescription": "MS-BELTING ANGLE-DP-50X50X6X1860-8.37KG",
      "sapUom": "NO",
      "sapItems": []
    },
    {
      "no": "40",
      "itemCode": "17005045",
      "desc": "Transformer Belting Angle (Short)",
      "unit": "Nos",
      "rate": 120,
      "sapDescription": "MS-BELTING ANGLE SHORT",
      "sapUom": "NO",
      "sapItems": []
    },
    {
      "no": "41",
      "itemCode": "",
      "desc": "Angle for LT DB",
      "unit": "Nos",
      "rate": 140,
      "sapDescription": "ANGLE FOR LT DB",
      "sapUom": "NO",
      "sapItems": []
    },
    {
      "no": "42",
      "itemCode": "",
      "desc": "Tie for AB Opreating Handle (Bracing)",
      "unit": "Nos",
      "rate": 150,
      "sapDescription": "TIE FOR AB OPERATING HANDLE",
      "sapUom": "NO",
      "sapItems": []
    },
    {
      "no": "43",
      "itemCode": "",
      "desc": "Transformer & AB Switch Support Angle",
      "unit": "Nos",
      "rate": 180,
      "sapDescription": "TRANSFORMER & AB SWITCH SUPPORT ANGLE",
      "sapUom": "NO",
      "sapItems": []
    },
    {
      "no": "44",
      "itemCode": "",
      "desc": "AB Switch pipe Support Angle (I-Bolt)",
      "unit": "Nos",
      "rate": 90,
      "sapDescription": "AB SWITCH PIPE SUPPORT ANGLE",
      "sapUom": "NO",
      "sapItems": []
    },
    {
      "no": "45",
      "itemCode": "17005043",
      "desc": "Support Angle SPCP Tie",
      "unit": "Nos",
      "rate": 150,
      "sapDescription": "MS-11KV CP BRCING ANG-50X50X6X1000-4.5KG",
      "sapUom": "NO",
      "sapItems": []
    },
    {
      "no": "",
      "itemCode": "",
      "desc": "Total Angle (50x50x6)",
      "unit": "Kg.",
      "rate": 0,
      "isSubtotal": true
    },
    {
      "no": "",
      "itemCode": "",
      "desc": "Weight For M.S.Flat 50X10 mm",
      "unit": "Unit",
      "rate": 0,
      "isSection": true
    },
    {
      "no": "46",
      "itemCode": "17005047",
      "desc": "Stay Clamp A & B Type",
      "unit": "Pair",
      "rate": 50,
      "sapDescription": "MS-STAY CL A TP-100X116-50X10X310-1.21KG",
      "sapUom": "NO",
      "sapItems": []
    },
    {
      "no": "47",
      "itemCode": "",
      "desc": "Side Clamp For Top Channels",
      "unit": "Nos",
      "rate": 40,
      "sapDescription": "SIDE CLAMP FOR TOP CHANNELS",
      "sapUom": "NO",
      "sapItems": []
    },
    {
      "no": "48",
      "itemCode": "",
      "desc": "Side Clamp For LA Angle",
      "unit": "Nos",
      "rate": 40,
      "sapDescription": "SIDE CLAMP FOR LA ANGLE",
      "sapUom": "NO",
      "sapItems": []
    },
    {
      "no": "49",
      "itemCode": "",
      "desc": "Side Clamp For DO Channel",
      "unit": "Nos",
      "rate": 40,
      "sapDescription": "SIDE CLAMP FOR DO CHANNEL",
      "sapUom": "NO",
      "sapItems": []
    },
    {
      "no": "50",
      "itemCode": "",
      "desc": "Side Clamp for Pipe Support Channel",
      "unit": "Nos",
      "rate": 40,
      "sapDescription": "SIDE CLAMP FOR PIPE SUPPORT CHANNEL",
      "sapUom": "NO",
      "sapItems": []
    },
    {
      "no": "51",
      "itemCode": "",
      "desc": "Side Clamp for Transformer Belt",
      "unit": "Nos",
      "rate": 40,
      "sapDescription": "SIDE CLAMP FOR TRANSFORMER BELT",
      "sapUom": "NO",
      "sapItems": []
    },
    {
      "no": "52",
      "itemCode": "",
      "desc": "Side Clamp for Transformer Base Channel",
      "unit": "Nos",
      "rate": 40,
      "sapDescription": "SIDE CLAMP FOR TRANSFORMER BASE CHANNEL",
      "sapUom": "NO",
      "sapItems": []
    },
    {
      "no": "53",
      "itemCode": "",
      "desc": "Side clamp For Box Angle",
      "unit": "Nos",
      "rate": 40,
      "sapDescription": "SIDE CLAMP FOR BOX ANGLE",
      "sapUom": "NO",
      "sapItems": []
    },
    {
      "no": "54",
      "itemCode": "",
      "desc": "Side Clamp For AB Switch Handel",
      "unit": "Nos",
      "rate": 40,
      "sapDescription": "SIDE CLAMP FOR AB SWITCH HANDLE",
      "sapUom": "NO",
      "sapItems": []
    },
    {
      "no": "55",
      "itemCode": "",
      "desc": "Side Clamp For AB Switch Handel Tie",
      "unit": "Pair",
      "rate": 50,
      "sapDescription": "SIDE CLAMP FOR AB SWITCH HANDLE TIE",
      "sapUom": "PAIR",
      "sapItems": []
    },
    {
      "no": "56",
      "itemCode": "17005046",
      "desc": "Side Clamp For V-Cross Arm (Extension)",
      "unit": "Nos",
      "rate": 40,
      "sapDescription": "MS-BK CL A TYPE-100X116-50X10X390-1.53KG",
      "sapUom": "NO",
      "sapItems": []
    },
    {
      "no": "57",
      "itemCode": "17005046",
      "desc": "Side Clamp For Top-Clit (Extension)",
      "unit": "Nos",
      "rate": 40,
      "sapDescription": "MS-BK CL A TYPE-100X116-50X10X390-1.53KG",
      "sapUom": "NO",
      "sapItems": []
    },
    {
      "no": "58",
      "itemCode": "17005049",
      "desc": "Fish Plate",
      "unit": "Nos",
      "rate": 30,
      "sapDescription": "MS-FISH PLATE-50X10X254-0.99KG",
      "sapUom": "NO",
      "sapItems": []
    },
    {
      "no": "",
      "itemCode": "",
      "desc": "Total M.S.Flat 50X10 mm",
      "unit": "Kg.",
      "rate": 0,
      "isSubtotal": true
    },
    {
      "no": "",
      "itemCode": "",
      "desc": "Weight For M.S.Flat 25x3 mm",
      "unit": "Unit",
      "rate": 0,
      "isSection": true
    },
    {
      "no": "59",
      "itemCode": "17001300",
      "desc": "Danger Board Clamp",
      "unit": "Kg.",
      "rate": 15,
      "sapDescription": "DANGER BOARD CLAMP 100X116 25X3X465 MM",
      "sapUom": "NO",
      "sapItems": [
        {
          "code": "17001300",
          "desc": "DANGER BOARD CLAMP 100X116 25X3X465 MM",
          "uom": "NO"
        }
      ]
    },
    {
      "no": "60",
      "itemCode": "17001294",
      "desc": "Barbed Wire Clamp",
      "unit": "Kg.",
      "rate": 15,
      "sapDescription": "BARBED WIRE CLAMP 100X116 25X3X320 MM",
      "sapUom": "NO",
      "sapItems": [
        {
          "code": "17001294",
          "desc": "BARBED WIRE CLAMP 100X116 25X3X320 MM",
          "uom": "NO"
        }
      ]
    },
    {
      "no": "",
      "itemCode": "",
      "desc": "Concreting ration 1:4:8",
      "unit": "Unit",
      "rate": 0,
      "isSection": true
    },
    {
      "no": "61",
      "itemCode": "11000336",
      "desc": "11M RSJ Pole",
      "unit": "Cmt",
      "rate": 2500,
      "sapDescription": "CEMENT GRADE OPC 53",
      "sapUom": "CMT",
      "sapItems": []
    },
    {
      "no": "62",
      "itemCode": "11000336",
      "desc": "HT Stay Set",
      "unit": "Cmt",
      "rate": 2500,
      "sapDescription": "CEMENT GRADE OPC 53",
      "sapUom": "CMT",
      "sapItems": []
    }
  ]
};

defaultPoleSchedules["1425a"] = defaultPoleSchedules["1425A"];

if (typeof window !== 'undefined') {
  window.defaultPoleSchedules = defaultPoleSchedules;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = defaultPoleSchedules;
}

