/**
 * @file Master SAP Code Contractor Mapping
 * @description Permanent master extracted from "SAP Code" sheet of stock.xlsx.
 * Maps all 211 Document Headers (Work Orders) and Vendor Codes to Contractor Groups.
 * This eliminates the need to provide or upload the "SAP Code" sheet with future stock dumps.
 * Users can upload raw stock transaction sheets (Sheet1) directly!
 */

(function(global) {
    global.MasterSapCodeMapping = {
  "meta": {
    "source": "stock.xlsx (SAP Code worksheet)",
    "extractedAt": "2026-11-16T06:09:55.442Z",
    "totalWorkOrders": 211,
    "totalContractorGroups": 117
  },
  "byDocHeader": {
    "31003359": {
      "docHeader": "31003359",
      "vendorCode": "500306505",
      "contractorName": "DUSKLINE INFRASTRUCTURE",
      "groupKey": "dusklineinfrastructure"
    },
    "31003360": {
      "docHeader": "31003360",
      "vendorCode": "500306505",
      "contractorName": "DUSKLINE INFRASTRUCTURE",
      "groupKey": "dusklineinfrastructure"
    },
    "31003362": {
      "docHeader": "31003362",
      "vendorCode": "500306505",
      "contractorName": "DUSKLINE INFRASTRUCTURE",
      "groupKey": "dusklineinfrastructure"
    },
    "31004922": {
      "docHeader": "31004922",
      "vendorCode": "",
      "contractorName": "Raial Infra ABL Dept.Teem",
      "groupKey": "raialinfraabldeptteem"
    },
    "31004923": {
      "docHeader": "31004923",
      "vendorCode": "",
      "contractorName": "Alvin Magre",
      "groupKey": "alvinmagre"
    },
    "31004924": {
      "docHeader": "31004924",
      "vendorCode": "",
      "contractorName": "Moktar Momin",
      "groupKey": "moktarmomin"
    },
    "31004925": {
      "docHeader": "31004925",
      "vendorCode": "500303597",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004926": {
      "docHeader": "31004926",
      "vendorCode": "500303597",
      "contractorName": "pratima Enterprises",
      "groupKey": "pratimaenterprises"
    },
    "31004997": {
      "docHeader": "31004997",
      "vendorCode": "500303597",
      "contractorName": "S. K. manglu",
      "groupKey": "skmanglu"
    },
    "31005044": {
      "docHeader": "31005044",
      "vendorCode": "500307891",
      "contractorName": "VECPL",
      "groupKey": "vecpl"
    },
    "31005169": {
      "docHeader": "31005169",
      "vendorCode": "",
      "contractorName": "Anjali Electricals Dayashankar",
      "groupKey": "anjalielectricalsdayashankar"
    },
    "31005171": {
      "docHeader": "31005171",
      "vendorCode": "500303597",
      "contractorName": "LK Electricals",
      "groupKey": "lkelectricals"
    },
    "31005172": {
      "docHeader": "31005172",
      "vendorCode": "500303597",
      "contractorName": "Anjali Electricals",
      "groupKey": "anjalielectricals"
    },
    "31005174": {
      "docHeader": "31005174",
      "vendorCode": "500303597",
      "contractorName": "ELICIV Private Limited",
      "groupKey": "elicivprivatelimited"
    },
    "31005195": {
      "docHeader": "31005195",
      "vendorCode": "",
      "contractorName": "Uttam Electrical",
      "groupKey": "uttamelectrical"
    },
    "31005260": {
      "docHeader": "31005260",
      "vendorCode": "500303597",
      "contractorName": "Sunita Electrical",
      "groupKey": "sunitaelectrical"
    },
    "31005262": {
      "docHeader": "31005262",
      "vendorCode": "500303597",
      "contractorName": "Pushpa Electricals & Contractor",
      "groupKey": "pushpaelectricalscontractor"
    },
    "31005306": {
      "docHeader": "31005306",
      "vendorCode": "500303597",
      "contractorName": "MANGAL MURTI",
      "groupKey": "mangalmurti"
    },
    "31005307": {
      "docHeader": "31005307",
      "vendorCode": "500303597",
      "contractorName": "MANOJ KUMAR RAI",
      "groupKey": "manojkumarrai"
    },
    "31005495": {
      "docHeader": "31005495",
      "vendorCode": "500303597",
      "contractorName": "J S R V",
      "groupKey": "jsrv"
    },
    "31005497": {
      "docHeader": "31005497",
      "vendorCode": "500303597",
      "contractorName": "SAI KRIPA",
      "groupKey": "saikripa"
    },
    "31005498": {
      "docHeader": "31005498",
      "vendorCode": "500303597",
      "contractorName": "MK. INFRA",
      "groupKey": "mkinfra"
    },
    "31005499": {
      "docHeader": "31005499",
      "vendorCode": "500303597",
      "contractorName": "PRAKASH ENTERPRISES",
      "groupKey": "prakashenterprises"
    },
    "31005517": {
      "docHeader": "31005517",
      "vendorCode": "500308075",
      "contractorName": "S K CONSTRUCTION",
      "groupKey": "skconstruction"
    },
    "31005613": {
      "docHeader": "31005613",
      "vendorCode": "500303597",
      "contractorName": "AMRUTA ELECTRICAL & CONT.",
      "groupKey": "amrutaelectricalcont"
    },
    "31005614": {
      "docHeader": "31005614",
      "vendorCode": "500303597",
      "contractorName": "PRAJWAL LANGE",
      "groupKey": "prajwallange"
    },
    "31005615": {
      "docHeader": "31005615",
      "vendorCode": "500303597",
      "contractorName": "JAI BALAJI ENTERPRISES",
      "groupKey": "jaibalajienterprises"
    },
    "31005616": {
      "docHeader": "31005616",
      "vendorCode": "500303597",
      "contractorName": "MONISH ENGINEERING AND SONS",
      "groupKey": "monishengineeringandsons"
    },
    "31005617": {
      "docHeader": "31005617",
      "vendorCode": "500303597",
      "contractorName": "POHEKAR & SONS     NARENDRA BABURAO POHESAR",
      "groupKey": "pohekarsonsnarendrababuraopohesar"
    },
    "31005618": {
      "docHeader": "31005618",
      "vendorCode": "500303597",
      "contractorName": "FRINDS MULTISERVICES CORPORATION",
      "groupKey": "frindsmultiservicescorporation"
    },
    "31005619": {
      "docHeader": "31005619",
      "vendorCode": "500303597",
      "contractorName": "BABA CONSTRUCTION",
      "groupKey": "babaconstruction"
    },
    "31005620": {
      "docHeader": "31005620",
      "vendorCode": "[object Object]",
      "contractorName": "ROXOR INFRASTRUCTURES PRIVATE LIMITED",
      "groupKey": "roxorinfrastructuresprivatelimited"
    },
    "31005621": {
      "docHeader": "31005621",
      "vendorCode": "500303597",
      "contractorName": "BABA CONSTRUCTION (VIKASH KUMAR DUBEY)",
      "groupKey": "babaconstruction"
    },
    "31005622": {
      "docHeader": "31005622",
      "vendorCode": "500303597",
      "contractorName": "SANDIP KUMAR RAY",
      "groupKey": "sandipkumarray"
    },
    "31005661": {
      "docHeader": "31005661",
      "vendorCode": "500308057",
      "contractorName": "BHAGWATI CONSTRUCTION",
      "groupKey": "bhagwaticonstruction"
    },
    "31005662": {
      "docHeader": "31005662",
      "vendorCode": "500306390",
      "contractorName": "KERE BABA ENTERPRISES",
      "groupKey": "kerebabaenterprises"
    },
    "31005685": {
      "docHeader": "31005685",
      "vendorCode": "500303597",
      "contractorName": "MANOJ KUMAR YADAV",
      "groupKey": "manojkumaryadav"
    },
    "31005686": {
      "docHeader": "31005686",
      "vendorCode": "500303597",
      "contractorName": "MANOJ KAUMAR MOHTO",
      "groupKey": "manojkaumarmohto"
    },
    "31005728": {
      "docHeader": "31005728",
      "vendorCode": "500308115",
      "contractorName": "RAATH BILDICON",
      "groupKey": "raathbildicon"
    },
    "31005766": {
      "docHeader": "31005766",
      "vendorCode": "500303597",
      "contractorName": "MANAAV ELECTRICALS",
      "groupKey": "manaavelectricals"
    },
    "31005767": {
      "docHeader": "31005767",
      "vendorCode": "500303597",
      "contractorName": "BRAMHANKAR ELECTRICALS",
      "groupKey": "bramhankarelectricals"
    },
    "31005768": {
      "docHeader": "31005768",
      "vendorCode": "500303597",
      "contractorName": "ANVI ENTERPRISES",
      "groupKey": "anvienterprises"
    },
    "31005769": {
      "docHeader": "31005769",
      "vendorCode": "500303597",
      "contractorName": "RAJ CONSTRUCTION",
      "groupKey": "rajconstruction"
    },
    "31005828": {
      "docHeader": "31005828",
      "vendorCode": "500308173",
      "contractorName": "J.P. SUPREME INFRATECH",
      "groupKey": "jpsupremeinfratech"
    },
    "31005862": {
      "docHeader": "31005862",
      "vendorCode": "500308185",
      "contractorName": "ESHTA TRADERS",
      "groupKey": "eshtatraders"
    },
    "31005885": {
      "docHeader": "31005885",
      "vendorCode": "500416876",
      "contractorName": "S.M. GROUP",
      "groupKey": "smgroup"
    },
    "31005887": {
      "docHeader": "31005887",
      "vendorCode": "500414775",
      "contractorName": "ARAV ENTERPRISES",
      "groupKey": "araventerprises"
    },
    "31005928": {
      "docHeader": "31005928",
      "vendorCode": "500303597",
      "contractorName": "MAHAK ENTERPRISES",
      "groupKey": "mahakenterprises"
    },
    "31005930": {
      "docHeader": "31005930",
      "vendorCode": "500303597",
      "contractorName": "PATHAN CONSTRUCTION",
      "groupKey": "pathanconstruction"
    },
    "31005932": {
      "docHeader": "31005932",
      "vendorCode": "500308021",
      "contractorName": "JAI MAA VINDHAVASINI",
      "groupKey": "jaimaavindhavasini"
    },
    "31005981": {
      "docHeader": "31005981",
      "vendorCode": "500303597",
      "contractorName": "NITESH NAMDEV ABHARE",
      "groupKey": "niteshnamdevabhare"
    },
    "31006000": {
      "docHeader": "31006000",
      "vendorCode": "500303597",
      "contractorName": "VIJAY TRADING COMPANY",
      "groupKey": "vijaytradingcompany"
    },
    "31006019": {
      "docHeader": "31006019",
      "vendorCode": "500308255",
      "contractorName": "Shri Ladali Ji Contractor",
      "groupKey": "shriladalijicontractor"
    },
    "31006062": {
      "docHeader": "31006062",
      "vendorCode": "500308248",
      "contractorName": "Shree Bala Jee Contractor & Supplier",
      "groupKey": "shreebalajeecontractorsupplier"
    },
    "31006105": {
      "docHeader": "31006105",
      "vendorCode": "500303597",
      "contractorName": "INTALLY DYNAMIX",
      "groupKey": "intallydynamix"
    },
    "31006106": {
      "docHeader": "31006106",
      "vendorCode": "500303597",
      "contractorName": "GAJRAJ ENTERPRISES",
      "groupKey": "gajrajenterprises"
    },
    "31006107": {
      "docHeader": "31006107",
      "vendorCode": "500303597",
      "contractorName": "INAYAT HUSAIN",
      "groupKey": "inayathusain"
    },
    "31006108": {
      "docHeader": "31006108",
      "vendorCode": "[object Object]",
      "contractorName": "RAVINDRA KAPGATE",
      "groupKey": "ravindrakapgate"
    },
    "31006110": {
      "docHeader": "31006110",
      "vendorCode": "500303597",
      "contractorName": "NANDKISHOR PRABHAKAR SELOTE",
      "groupKey": "nandkishorprabhakarselote"
    },
    "31006111": {
      "docHeader": "31006111",
      "vendorCode": "500303597",
      "contractorName": "BHASKAR ASHOK SONWARE",
      "groupKey": "bhaskarashoksonware"
    },
    "31006296": {
      "docHeader": "31006296",
      "vendorCode": "500303597",
      "contractorName": "SHRI RAM ENTERPRISES",
      "groupKey": "shriramenterprises"
    },
    "31006314": {
      "docHeader": "31006314",
      "vendorCode": "500411387",
      "contractorName": "ADITYA ENTERPRISES Departmental",
      "groupKey": "adityaenterprisesdepartmental"
    },
    "31006329": {
      "docHeader": "31006329",
      "vendorCode": "500303597",
      "contractorName": "UTKARSH ENTERPRISES",
      "groupKey": "utkarshenterprises"
    },
    "31006343": {
      "docHeader": "31006343",
      "vendorCode": "500303597",
      "contractorName": "Kalpvriksha Electrical",
      "groupKey": "kalpvrikshaelectrical"
    },
    "31006344": {
      "docHeader": "31006344",
      "vendorCode": "500303597",
      "contractorName": "DK Electrical",
      "groupKey": "dkelectrical"
    },
    "31006345": {
      "docHeader": "31006345",
      "vendorCode": "500306274",
      "contractorName": "RANJEET SINGH LODHI",
      "groupKey": "ranjeetsinghlodhi"
    },
    "31006347": {
      "docHeader": "31006347",
      "vendorCode": "500300277",
      "contractorName": "MAA BHAWANI CONSTRUCTION",
      "groupKey": "maabhawaniconstruction"
    },
    "31006363": {
      "docHeader": "31006363",
      "vendorCode": "500303597",
      "contractorName": "Prashant Electrical",
      "groupKey": "prashantelectrical"
    },
    "31006364": {
      "docHeader": "31006364",
      "vendorCode": "500303597",
      "contractorName": "Kavi Enterprises",
      "groupKey": "kavienterprises"
    },
    "31006365": {
      "docHeader": "31006365",
      "vendorCode": "500303597",
      "contractorName": "Saurabh Dehariya",
      "groupKey": "saurabhdehariya"
    },
    "31006555": {
      "docHeader": "31006555",
      "vendorCode": "500303597",
      "contractorName": "V C Enterprises",
      "groupKey": "vcenterprises"
    },
    "31006556": {
      "docHeader": "31006556",
      "vendorCode": "[object Object]",
      "contractorName": "Rudra Enterprises",
      "groupKey": "rudraenterprises"
    },
    "31006557": {
      "docHeader": "31006557",
      "vendorCode": "500303597",
      "contractorName": "Newone Projects Private Limited",
      "groupKey": "newoneprojectsprivatelimited"
    },
    "31006558": {
      "docHeader": "31006558",
      "vendorCode": "[object Object]",
      "contractorName": "Priyanka Electricals",
      "groupKey": "priyankaelectricals"
    },
    "31006559": {
      "docHeader": "31006559",
      "vendorCode": "[object Object]",
      "contractorName": "MDS Construction",
      "groupKey": "mdsconstruction"
    },
    "31006572": {
      "docHeader": "31006572",
      "vendorCode": "500303597",
      "contractorName": "ANURAGI BROTHERS",
      "groupKey": "anuragibrothers"
    },
    "31006573": {
      "docHeader": "31006573",
      "vendorCode": "500303597",
      "contractorName": "M/S PARVEJ AALAM KHAN",
      "groupKey": "parvejaalamkhan"
    },
    "31006574": {
      "docHeader": "31006574",
      "vendorCode": "[object Object]",
      "contractorName": "M/S SHRI SAWARIYA SETH CONSTRUCTION",
      "groupKey": "shrisawariyasethconstruction"
    },
    "31006575": {
      "docHeader": "31006575",
      "vendorCode": "500303597",
      "contractorName": "SUBHADRA NARAYAN AUTOMBOLE",
      "groupKey": "subhadranarayanautombole"
    },
    "31006606": {
      "docHeader": "31006606",
      "vendorCode": "500307831",
      "contractorName": "VISHWAKARMA ENTERPRISES",
      "groupKey": "vishwakarmaenterprises"
    },
    "31006785": {
      "docHeader": "31006785",
      "vendorCode": "500303597",
      "contractorName": "BALUKISAN DAEADE",
      "groupKey": "balukisandaeade"
    },
    "31006786": {
      "docHeader": "31006786",
      "vendorCode": "500308483",
      "contractorName": "D S INFRASTUACTURE",
      "groupKey": "dsinfrastuacture"
    },
    "31006817": {
      "docHeader": "31006817",
      "vendorCode": "500303597",
      "contractorName": "LODHI INFRA PROJECT PVT LTD",
      "groupKey": "lodhiinfraprojectpvtltd"
    },
    "31006829": {
      "docHeader": "31006829",
      "vendorCode": "500308511",
      "contractorName": "Pradeep construction",
      "groupKey": "pradeepconstruction"
    },
    "31006847": {
      "docHeader": "31006847",
      "vendorCode": "500303597",
      "contractorName": "RATANGHOS WAMAN LANDGE",
      "groupKey": "ratanghoswamanlandge"
    },
    "31006849": {
      "docHeader": "31006849",
      "vendorCode": "500303597",
      "contractorName": "HIVRAJ MARASHKOLHE",
      "groupKey": "hivrajmarashkolhe"
    },
    "31006866": {
      "docHeader": "31006866",
      "vendorCode": "500303597",
      "contractorName": "SAILESH BHOYAR",
      "groupKey": "saileshbhoyar"
    },
    "31006869": {
      "docHeader": "31006869",
      "vendorCode": "500308520",
      "contractorName": "SATENDRA SINGH THEKEDAR",
      "groupKey": "satendrasinghthekedar"
    },
    "31006871": {
      "docHeader": "31006871",
      "vendorCode": "500308519",
      "contractorName": "THEKEDAR SATYENDRA SINGH",
      "groupKey": "thekedarsatyendrasingh"
    },
    "31006930": {
      "docHeader": "31006930",
      "vendorCode": "",
      "contractorName": "JAI BALAJI ENTERPRISES 2",
      "groupKey": "jaibalajienterprises2"
    },
    "31006978": {
      "docHeader": "31006978",
      "vendorCode": "",
      "contractorName": "Shriji Enterprises",
      "groupKey": "shrijienterprises"
    },
    "31007012": {
      "docHeader": "31007012",
      "vendorCode": "",
      "contractorName": "PARTH ENTERISES",
      "groupKey": "parthenterises"
    },
    "31007013": {
      "docHeader": "31007013",
      "vendorCode": "[object Object]",
      "contractorName": "SAMRAT ENTERPRISES",
      "groupKey": "samratenterprises"
    },
    "31007014": {
      "docHeader": "31007014",
      "vendorCode": "",
      "contractorName": "NIHARIKA ENTERPRISES",
      "groupKey": "niharikaenterprises"
    },
    "31007078": {
      "docHeader": "31007078",
      "vendorCode": "",
      "contractorName": "Ayansh Enterprises",
      "groupKey": "ayanshenterprises"
    },
    "31007079": {
      "docHeader": "31007079",
      "vendorCode": "",
      "contractorName": "Narayan Construction",
      "groupKey": "narayanconstruction"
    },
    "31007082": {
      "docHeader": "31007082",
      "vendorCode": "",
      "contractorName": "Shivam Enterprises & Building material",
      "groupKey": "shivamenterprisesbuildingmaterial"
    },
    "31007083": {
      "docHeader": "31007083",
      "vendorCode": "",
      "contractorName": "M/s. Balaji Construction",
      "groupKey": "balajiconstruction"
    },
    "31007092": {
      "docHeader": "31007092",
      "vendorCode": "",
      "contractorName": "Shri Shyam Traders",
      "groupKey": "shrishyamtraders"
    },
    "31007122": {
      "docHeader": "31007122",
      "vendorCode": "",
      "contractorName": "Shri Laxmi Enterprises",
      "groupKey": "shrilaxmienterprises"
    },
    "31007201": {
      "docHeader": "31007201",
      "vendorCode": "",
      "contractorName": "Nitin Kesharao Randive",
      "groupKey": "nitinkesharaorandive"
    },
    "31007223": {
      "docHeader": "31007223",
      "vendorCode": "",
      "contractorName": "Lodhi Contractor",
      "groupKey": "lodhicontractor"
    },
    "31007236": {
      "docHeader": "31007236",
      "vendorCode": "",
      "contractorName": "Manohar Traders",
      "groupKey": "manohartraders"
    },
    "31007244": {
      "docHeader": "31007244",
      "vendorCode": "",
      "contractorName": "Nitya Enterprises",
      "groupKey": "nityaenterprises"
    },
    "31007269": {
      "docHeader": "31007269",
      "vendorCode": "",
      "contractorName": "ADITYA ENTERPRISES Infra work",
      "groupKey": "adityaenterprisesinfrawork"
    },
    "31007389": {
      "docHeader": "31007389",
      "vendorCode": "",
      "contractorName": "Sai Enterprises",
      "groupKey": "saienterprises"
    },
    "31007398": {
      "docHeader": "31007398",
      "vendorCode": "",
      "contractorName": "Ayush Electricals",
      "groupKey": "ayushelectricals"
    },
    "31007408": {
      "docHeader": "31007408",
      "vendorCode": "",
      "contractorName": "Ramu Laxman Walthare",
      "groupKey": "ramulaxmanwalthare"
    },
    "31007460": {
      "docHeader": "31007460",
      "vendorCode": "",
      "contractorName": "Anil Kumar Mauriya",
      "groupKey": "anilkumarmauriya"
    },
    "31007467": {
      "docHeader": "31007467",
      "vendorCode": "",
      "contractorName": "MA KALI ENTERPRISE",
      "groupKey": "makalienterprise"
    },
    "31007557": {
      "docHeader": "31007557",
      "vendorCode": "",
      "contractorName": "Anshuman Enterprises",
      "groupKey": "anshumanenterprises"
    },
    "31007558": {
      "docHeader": "31007558",
      "vendorCode": "",
      "contractorName": "Intally Dynamix Private Limited",
      "groupKey": "intallydynamixprivatelimited"
    },
    "31007559": {
      "docHeader": "31007559",
      "vendorCode": "",
      "contractorName": "Ravindra Kashiram Kapgate",
      "groupKey": "ravindrakashiramkapgate"
    },
    "31007560": {
      "docHeader": "31007560",
      "vendorCode": "",
      "contractorName": "Alka Manoj Ramteke",
      "groupKey": "alkamanojramteke"
    },
    "31007561": {
      "docHeader": "31007561",
      "vendorCode": "",
      "contractorName": "Bhavesh Engineering Works",
      "groupKey": "bhaveshengineeringworks"
    },
    "31007576": {
      "docHeader": "31007576",
      "vendorCode": "",
      "contractorName": "SN ENTERPRISE",
      "groupKey": "snenterprise"
    },
    "31007613": {
      "docHeader": "31007613",
      "vendorCode": "",
      "contractorName": "M/s AB ENTERPRISES",
      "groupKey": "abenterprises"
    },
    "31007614": {
      "docHeader": "31007614",
      "vendorCode": "",
      "contractorName": "M/s Chandanraj Ravindra Kapgate",
      "groupKey": "chandanrajravindrakapgate"
    },
    "31007641": {
      "docHeader": "31007641",
      "vendorCode": "",
      "contractorName": "Mangesh Ashok Sonwane New",
      "groupKey": "mangeshashoksonwanenew"
    },
    "31004925 MRN-04": {
      "docHeader": "31004925 MRN-04",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 RAVINDRA KAPGATE": {
      "docHeader": "31004925 RAVINDRA KAPGATE",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MRN-27": {
      "docHeader": "31004925 MRN-27",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-2232": {
      "docHeader": "31004925 MDC-2232",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MRN-28": {
      "docHeader": "31004925 MRN-28",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MRN-25": {
      "docHeader": "31004925 MRN-25",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-482": {
      "docHeader": "31004925 MDC-482",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-1840": {
      "docHeader": "31004925 MDC-1840",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-1841": {
      "docHeader": "31004925 MDC-1841",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-1951": {
      "docHeader": "31004925 MDC-1951",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-159": {
      "docHeader": "31004925 MDC-159",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-85": {
      "docHeader": "31004925 MDC-85",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-1848": {
      "docHeader": "31004925 MDC-1848",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-525": {
      "docHeader": "31004925 MDC-525",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-569": {
      "docHeader": "31004925 MDC-569",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-468": {
      "docHeader": "31004925 MDC-468",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-1919": {
      "docHeader": "31004925 MDC-1919",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-50": {
      "docHeader": "31004925 MDC-50",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-47": {
      "docHeader": "31004925 MDC-47",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-515": {
      "docHeader": "31004925 MDC-515",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-494": {
      "docHeader": "31004925 MDC-494",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-561": {
      "docHeader": "31004925 MDC-561",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-2334": {
      "docHeader": "31004925 MDC-2334",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-353": {
      "docHeader": "31004925 MDC-353",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-2207": {
      "docHeader": "31004925 MDC-2207",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-239": {
      "docHeader": "31004925 MDC-239",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-141": {
      "docHeader": "31004925 MDC-141",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-1889": {
      "docHeader": "31004925 MDC-1889",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-409": {
      "docHeader": "31004925 MDC-409",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-312": {
      "docHeader": "31004925 MDC-312",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-187": {
      "docHeader": "31004925 MDC-187",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-171": {
      "docHeader": "31004925 MDC-171",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-439": {
      "docHeader": "31004925 MDC-439",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-425": {
      "docHeader": "31004925 MDC-425",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-111": {
      "docHeader": "31004925 MDC-111",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-438": {
      "docHeader": "31004925 MDC-438",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-166": {
      "docHeader": "31004925 MDC-166",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-220": {
      "docHeader": "31004925 MDC-220",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-1921": {
      "docHeader": "31004925 MDC-1921",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-584": {
      "docHeader": "31004925 MDC-584",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-489": {
      "docHeader": "31004925 MDC-489",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-40": {
      "docHeader": "31004925 MDC-40",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-428": {
      "docHeader": "31004925 MDC-428",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-453": {
      "docHeader": "31004925 MDC-453",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-1888": {
      "docHeader": "31004925 MDC-1888",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-405": {
      "docHeader": "31004925 MDC-405",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004925 MDC-404": {
      "docHeader": "31004925 MDC-404",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "31004997 MDC-44": {
      "docHeader": "31004997 MDC-44",
      "vendorCode": "",
      "contractorName": "S. K. manglu",
      "groupKey": "skmanglu"
    },
    "31004997 MDC-1872": {
      "docHeader": "31004997 MDC-1872",
      "vendorCode": "",
      "contractorName": "S. K. manglu",
      "groupKey": "skmanglu"
    },
    "31004997 MDC-100": {
      "docHeader": "31004997 MDC-100",
      "vendorCode": "",
      "contractorName": "S. K. manglu",
      "groupKey": "skmanglu"
    },
    "31004997 MDC-1860": {
      "docHeader": "31004997 MDC-1860",
      "vendorCode": "",
      "contractorName": "S. K. manglu",
      "groupKey": "skmanglu"
    },
    "31004997 MDC-1861": {
      "docHeader": "31004997 MDC-1861",
      "vendorCode": "",
      "contractorName": "S. K. manglu",
      "groupKey": "skmanglu"
    },
    "MDC-46 W/O 31004997": {
      "docHeader": "MDC-46 W/O 31004997",
      "vendorCode": "",
      "contractorName": "S. K. manglu",
      "groupKey": "skmanglu"
    },
    "SUNITA ELECTRICLAS": {
      "docHeader": "SUNITA ELECTRICLAS",
      "vendorCode": "",
      "contractorName": "Sunita Electrical",
      "groupKey": "sunitaelectrical"
    },
    "31005260 MDC-386": {
      "docHeader": "31005260 MDC-386",
      "vendorCode": "",
      "contractorName": "Sunita Electrical",
      "groupKey": "sunitaelectrical"
    },
    "31005260 MDC-552": {
      "docHeader": "31005260 MDC-552",
      "vendorCode": "",
      "contractorName": "Sunita Electrical",
      "groupKey": "sunitaelectrical"
    },
    "31005260 MDC-559": {
      "docHeader": "31005260 MDC-559",
      "vendorCode": "",
      "contractorName": "Sunita Electrical",
      "groupKey": "sunitaelectrical"
    },
    "31005260 MDC-314": {
      "docHeader": "31005260 MDC-314",
      "vendorCode": "",
      "contractorName": "Sunita Electrical",
      "groupKey": "sunitaelectrical"
    },
    "31005260 MDC-246": {
      "docHeader": "31005260 MDC-246",
      "vendorCode": "",
      "contractorName": "Sunita Electrical",
      "groupKey": "sunitaelectrical"
    },
    "31005260 MDC-616": {
      "docHeader": "31005260 MDC-616",
      "vendorCode": "",
      "contractorName": "Sunita Electrical",
      "groupKey": "sunitaelectrical"
    },
    "MUKTAR MOMIN MDC-1846": {
      "docHeader": "MUKTAR MOMIN MDC-1846",
      "vendorCode": "",
      "contractorName": "Moktar Momin",
      "groupKey": "moktarmomin"
    },
    "MUKTAR MOMIN MDC-2348": {
      "docHeader": "MUKTAR MOMIN MDC-2348",
      "vendorCode": "",
      "contractorName": "Moktar Momin",
      "groupKey": "moktarmomin"
    },
    "MUKTAR MOMIN": {
      "docHeader": "MUKTAR MOMIN",
      "vendorCode": "",
      "contractorName": "Moktar Momin",
      "groupKey": "moktarmomin"
    },
    "MUKTAR MOMIN MRN-106": {
      "docHeader": "MUKTAR MOMIN MRN-106",
      "vendorCode": "",
      "contractorName": "Moktar Momin",
      "groupKey": "moktarmomin"
    },
    "MUKHTAR MOMIN MDC-106": {
      "docHeader": "MUKHTAR MOMIN MDC-106",
      "vendorCode": "",
      "contractorName": "Moktar Momin",
      "groupKey": "moktarmomin"
    },
    "MUKHTAR MOMIN": {
      "docHeader": "MUKHTAR MOMIN",
      "vendorCode": "",
      "contractorName": "Moktar Momin",
      "groupKey": "moktarmomin"
    },
    "MUKHTAR MOMIN MDC-67": {
      "docHeader": "MUKHTAR MOMIN MDC-67",
      "vendorCode": "",
      "contractorName": "Moktar Momin",
      "groupKey": "moktarmomin"
    },
    "MUKHTAR MOMIN MDC-61": {
      "docHeader": "MUKHTAR MOMIN MDC-61",
      "vendorCode": "",
      "contractorName": "Moktar Momin",
      "groupKey": "moktarmomin"
    },
    "31005619 MDC-485": {
      "docHeader": "31005619 MDC-485",
      "vendorCode": "",
      "contractorName": "BABA CONSTRUCTION",
      "groupKey": "babaconstruction"
    },
    "31005498 MDC-463": {
      "docHeader": "31005498 MDC-463",
      "vendorCode": "",
      "contractorName": "MK. INFRA",
      "groupKey": "mkinfra"
    },
    "31005495 MDC-519": {
      "docHeader": "31005495 MDC-519",
      "vendorCode": "",
      "contractorName": "J S R V",
      "groupKey": "jsrv"
    },
    "RAVINDRA KAPGADE MDC-436": {
      "docHeader": "RAVINDRA KAPGADE MDC-436",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "TALLY DYNAMIX MDC-1832": {
      "docHeader": "TALLY DYNAMIX MDC-1832",
      "vendorCode": "",
      "contractorName": "TALLY DYNAMIX",
      "groupKey": "tallydynamix"
    },
    "31005495 MDC-487": {
      "docHeader": "31005495 MDC-487",
      "vendorCode": "",
      "contractorName": "J S R V",
      "groupKey": "jsrv"
    },
    "31005685 MDC-379": {
      "docHeader": "31005685 MDC-379",
      "vendorCode": "",
      "contractorName": "MANOJ KUMAR YADAV",
      "groupKey": "manojkumaryadav"
    },
    "31005617 MDC-452": {
      "docHeader": "31005617 MDC-452",
      "vendorCode": "",
      "contractorName": "POHEKAR & SONS     NARENDRA BABURAO POHESAR",
      "groupKey": "pohekarsonsnarendrababuraopohesar"
    },
    "31005617 MDC-575": {
      "docHeader": "31005617 MDC-575",
      "vendorCode": "",
      "contractorName": "POHEKAR & SONS     NARENDRA BABURAO POHESAR",
      "groupKey": "pohekarsonsnarendrababuraopohesar"
    },
    "31005617 MDC-531": {
      "docHeader": "31005617 MDC-531",
      "vendorCode": "",
      "contractorName": "POHEKAR & SONS     NARENDRA BABURAO POHESAR",
      "groupKey": "pohekarsonsnarendrababuraopohesar"
    },
    "31005617 MDC-555": {
      "docHeader": "31005617 MDC-555",
      "vendorCode": "",
      "contractorName": "POHEKAR & SONS     NARENDRA BABURAO POHESAR",
      "groupKey": "pohekarsonsnarendrababuraopohesar"
    },
    "31005617 MDC-490": {
      "docHeader": "31005617 MDC-490",
      "vendorCode": "",
      "contractorName": "POHEKAR & SONS     NARENDRA BABURAO POHESAR",
      "groupKey": "pohekarsonsnarendrababuraopohesar"
    },
    "31005617 MDC-382": {
      "docHeader": "31005617 MDC-382",
      "vendorCode": "",
      "contractorName": "POHEKAR & SONS     NARENDRA BABURAO POHESAR",
      "groupKey": "pohekarsonsnarendrababuraopohesar"
    },
    "31005686 MDC-470": {
      "docHeader": "31005686 MDC-470",
      "vendorCode": "",
      "contractorName": "MANOJ KAUMAR MOHTO",
      "groupKey": "manojkaumarmohto"
    },
    "31004922 MDC-1837": {
      "docHeader": "31004922 MDC-1837",
      "vendorCode": "",
      "contractorName": "Raial Infra ABL Dept.Teem",
      "groupKey": "raialinfraabldeptteem"
    },
    "31004922 MDC-1847": {
      "docHeader": "31004922 MDC-1847",
      "vendorCode": "",
      "contractorName": "Raial Infra ABL Dept.Teem",
      "groupKey": "raialinfraabldeptteem"
    },
    "31004866 MDC-315": {
      "docHeader": "31004866 MDC-315",
      "vendorCode": "",
      "contractorName": "TALLY DYNAMIX",
      "groupKey": "tallydynamix"
    },
    "TALLY DYNAMIX MDC-345": {
      "docHeader": "TALLY DYNAMIX MDC-345",
      "vendorCode": "",
      "contractorName": "TALLY DYNAMIX",
      "groupKey": "tallydynamix"
    },
    "TALLY DYNAMIX MDC-332": {
      "docHeader": "TALLY DYNAMIX MDC-332",
      "vendorCode": "",
      "contractorName": "TALLY DYNAMIX",
      "groupKey": "tallydynamix"
    },
    "RAIAL INFRA MDC-1837": {
      "docHeader": "RAIAL INFRA MDC-1837",
      "vendorCode": "",
      "contractorName": "Raial Infra ABL Dept.Teem",
      "groupKey": "raialinfraabldeptteem"
    },
    "RAVINDRA KAPGADE MDC-1802": {
      "docHeader": "RAVINDRA KAPGADE MDC-1802",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "RAVINDRA KAPGADE MDC-1851": {
      "docHeader": "RAVINDRA KAPGADE MDC-1851",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "RAVINDRA KAPGADE MDC-025": {
      "docHeader": "RAVINDRA KAPGADE MDC-025",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    },
    "SANDEEP KUMAR RAI MDC-183": {
      "docHeader": "SANDEEP KUMAR RAI MDC-183",
      "vendorCode": "",
      "contractorName": "Ravindra kapgade",
      "groupKey": "ravindrakapgade"
    }
  },
  "dhToGroupKey": {
    "31003359": "dusklineinfrastructure",
    "31003360": "dusklineinfrastructure",
    "31003362": "dusklineinfrastructure",
    "31004922": "raialinfraabldeptteem",
    "31004923": "alvinmagre",
    "31004924": "moktarmomin",
    "31004925": "ravindrakapgade",
    "31004926": "pratimaenterprises",
    "31004997": "skmanglu",
    "31005044": "vecpl",
    "31005169": "anjalielectricalsdayashankar",
    "31005171": "lkelectricals",
    "31005172": "anjalielectricals",
    "31005174": "elicivprivatelimited",
    "31005195": "uttamelectrical",
    "31005260": "sunitaelectrical",
    "31005262": "pushpaelectricalscontractor",
    "31005306": "mangalmurti",
    "31005307": "manojkumarrai",
    "31005495": "jsrv",
    "31005497": "saikripa",
    "31005498": "mkinfra",
    "31005499": "prakashenterprises",
    "31005517": "skconstruction",
    "31005613": "amrutaelectricalcont",
    "31005614": "prajwallange",
    "31005615": "jaibalajienterprises",
    "31005616": "monishengineeringandsons",
    "31005617": "pohekarsonsnarendrababuraopohesar",
    "31005618": "frindsmultiservicescorporation",
    "31005619": "babaconstruction",
    "31005620": "roxorinfrastructuresprivatelimited",
    "31005621": "babaconstruction",
    "31005622": "sandipkumarray",
    "31005661": "bhagwaticonstruction",
    "31005662": "kerebabaenterprises",
    "31005685": "manojkumaryadav",
    "31005686": "manojkaumarmohto",
    "31005728": "raathbildicon",
    "31005766": "manaavelectricals",
    "31005767": "bramhankarelectricals",
    "31005768": "anvienterprises",
    "31005769": "rajconstruction",
    "31005828": "jpsupremeinfratech",
    "31005862": "eshtatraders",
    "31005885": "smgroup",
    "31005887": "araventerprises",
    "31005928": "mahakenterprises",
    "31005930": "pathanconstruction",
    "31005932": "jaimaavindhavasini",
    "31005981": "niteshnamdevabhare",
    "31006000": "vijaytradingcompany",
    "31006019": "shriladalijicontractor",
    "31006062": "shreebalajeecontractorsupplier",
    "31006105": "intallydynamix",
    "31006106": "gajrajenterprises",
    "31006107": "inayathusain",
    "31006108": "ravindrakapgate",
    "31006110": "nandkishorprabhakarselote",
    "31006111": "bhaskarashoksonware",
    "31006296": "shriramenterprises",
    "31006314": "adityaenterprisesdepartmental",
    "31006329": "utkarshenterprises",
    "31006343": "kalpvrikshaelectrical",
    "31006344": "dkelectrical",
    "31006345": "ranjeetsinghlodhi",
    "31006347": "maabhawaniconstruction",
    "31006363": "prashantelectrical",
    "31006364": "kavienterprises",
    "31006365": "saurabhdehariya",
    "31006555": "vcenterprises",
    "31006556": "rudraenterprises",
    "31006557": "newoneprojectsprivatelimited",
    "31006558": "priyankaelectricals",
    "31006559": "mdsconstruction",
    "31006572": "anuragibrothers",
    "31006573": "parvejaalamkhan",
    "31006574": "shrisawariyasethconstruction",
    "31006575": "subhadranarayanautombole",
    "31006606": "vishwakarmaenterprises",
    "31006785": "balukisandaeade",
    "31006786": "dsinfrastuacture",
    "31006817": "lodhiinfraprojectpvtltd",
    "31006829": "pradeepconstruction",
    "31006847": "ratanghoswamanlandge",
    "31006849": "hivrajmarashkolhe",
    "31006866": "saileshbhoyar",
    "31006869": "satendrasinghthekedar",
    "31006871": "thekedarsatyendrasingh",
    "31006930": "jaibalajienterprises2",
    "31006978": "shrijienterprises",
    "31007012": "parthenterises",
    "31007013": "samratenterprises",
    "31007014": "niharikaenterprises",
    "31007078": "ayanshenterprises",
    "31007079": "narayanconstruction",
    "31007082": "shivamenterprisesbuildingmaterial",
    "31007083": "balajiconstruction",
    "31007092": "shrishyamtraders",
    "31007122": "shrilaxmienterprises",
    "31007201": "nitinkesharaorandive",
    "31007223": "lodhicontractor",
    "31007236": "manohartraders",
    "31007244": "nityaenterprises",
    "31007269": "adityaenterprisesinfrawork",
    "31007389": "saienterprises",
    "31007398": "ayushelectricals",
    "31007408": "ramulaxmanwalthare",
    "31007460": "anilkumarmauriya",
    "31007467": "makalienterprise",
    "31007557": "anshumanenterprises",
    "31007558": "intallydynamixprivatelimited",
    "31007559": "ravindrakashiramkapgate",
    "31007560": "alkamanojramteke",
    "31007561": "bhaveshengineeringworks",
    "31007576": "snenterprise",
    "31007613": "abenterprises",
    "31007614": "chandanrajravindrakapgate",
    "31007641": "mangeshashoksonwanenew",
    "31004925 MRN-04": "ravindrakapgade",
    "31004925 RAVINDRA KAPGATE": "ravindrakapgade",
    "31004925 MRN-27": "ravindrakapgade",
    "31004925 MDC-2232": "ravindrakapgade",
    "31004925 MRN-28": "ravindrakapgade",
    "31004925 MRN-25": "ravindrakapgade",
    "31004925 MDC-482": "ravindrakapgade",
    "31004925 MDC-1840": "ravindrakapgade",
    "31004925 MDC-1841": "ravindrakapgade",
    "31004925 MDC-1951": "ravindrakapgade",
    "31004925 MDC-159": "ravindrakapgade",
    "31004925 MDC-85": "ravindrakapgade",
    "31004925 MDC-1848": "ravindrakapgade",
    "31004925 MDC-525": "ravindrakapgade",
    "31004925 MDC-569": "ravindrakapgade",
    "31004925 MDC-468": "ravindrakapgade",
    "31004925 MDC-1919": "ravindrakapgade",
    "31004925 MDC-50": "ravindrakapgade",
    "31004925 MDC-47": "ravindrakapgade",
    "31004925 MDC-515": "ravindrakapgade",
    "31004925 MDC-494": "ravindrakapgade",
    "31004925 MDC-561": "ravindrakapgade",
    "31004925 MDC-2334": "ravindrakapgade",
    "31004925 MDC-353": "ravindrakapgade",
    "31004925 MDC-2207": "ravindrakapgade",
    "31004925 MDC-239": "ravindrakapgade",
    "31004925 MDC-141": "ravindrakapgade",
    "31004925 MDC-1889": "ravindrakapgade",
    "31004925 MDC-409": "ravindrakapgade",
    "31004925 MDC-312": "ravindrakapgade",
    "31004925 MDC-187": "ravindrakapgade",
    "31004925 MDC-171": "ravindrakapgade",
    "31004925 MDC-439": "ravindrakapgade",
    "31004925 MDC-425": "ravindrakapgade",
    "31004925 MDC-111": "ravindrakapgade",
    "31004925 MDC-438": "ravindrakapgade",
    "31004925 MDC-166": "ravindrakapgade",
    "31004925 MDC-220": "ravindrakapgade",
    "31004925 MDC-1921": "ravindrakapgade",
    "31004925 MDC-584": "ravindrakapgade",
    "31004925 MDC-489": "ravindrakapgade",
    "31004925 MDC-40": "ravindrakapgade",
    "31004925 MDC-428": "ravindrakapgade",
    "31004925 MDC-453": "ravindrakapgade",
    "31004925 MDC-1888": "ravindrakapgade",
    "31004925 MDC-405": "ravindrakapgade",
    "31004925 MDC-404": "ravindrakapgade",
    "31004997 MDC-44": "skmanglu",
    "31004997 MDC-1872": "skmanglu",
    "31004997 MDC-100": "skmanglu",
    "31004997 MDC-1860": "skmanglu",
    "31004997 MDC-1861": "skmanglu",
    "MDC-46 W/O 31004997": "skmanglu",
    "SUNITA ELECTRICLAS": "sunitaelectrical",
    "31005260 MDC-386": "sunitaelectrical",
    "31005260 MDC-552": "sunitaelectrical",
    "31005260 MDC-559": "sunitaelectrical",
    "31005260 MDC-314": "sunitaelectrical",
    "31005260 MDC-246": "sunitaelectrical",
    "31005260 MDC-616": "sunitaelectrical",
    "MUKTAR MOMIN MDC-1846": "moktarmomin",
    "MUKTAR MOMIN MDC-2348": "moktarmomin",
    "MUKTAR MOMIN": "moktarmomin",
    "MUKTAR MOMIN MRN-106": "moktarmomin",
    "MUKHTAR MOMIN MDC-106": "moktarmomin",
    "MUKHTAR MOMIN": "moktarmomin",
    "MUKHTAR MOMIN MDC-67": "moktarmomin",
    "MUKHTAR MOMIN MDC-61": "moktarmomin",
    "31005619 MDC-485": "babaconstruction",
    "31005498 MDC-463": "mkinfra",
    "31005495 MDC-519": "jsrv",
    "RAVINDRA KAPGADE MDC-436": "ravindrakapgade",
    "TALLY DYNAMIX MDC-1832": "tallydynamix",
    "31005495 MDC-487": "jsrv",
    "31005685 MDC-379": "manojkumaryadav",
    "31005617 MDC-452": "pohekarsonsnarendrababuraopohesar",
    "31005617 MDC-575": "pohekarsonsnarendrababuraopohesar",
    "31005617 MDC-531": "pohekarsonsnarendrababuraopohesar",
    "31005617 MDC-555": "pohekarsonsnarendrababuraopohesar",
    "31005617 MDC-490": "pohekarsonsnarendrababuraopohesar",
    "31005617 MDC-382": "pohekarsonsnarendrababuraopohesar",
    "31005686 MDC-470": "manojkaumarmohto",
    "31004922 MDC-1837": "raialinfraabldeptteem",
    "31004922 MDC-1847": "raialinfraabldeptteem",
    "31004866 MDC-315": "tallydynamix",
    "TALLY DYNAMIX MDC-345": "tallydynamix",
    "TALLY DYNAMIX MDC-332": "tallydynamix",
    "RAIAL INFRA MDC-1837": "raialinfraabldeptteem",
    "RAVINDRA KAPGADE MDC-1802": "ravindrakapgade",
    "RAVINDRA KAPGADE MDC-1851": "ravindrakapgade",
    "RAVINDRA KAPGADE MDC-025": "ravindrakapgade",
    "SANDEEP KUMAR RAI MDC-183": "ravindrakapgade"
  },
  "woToGroupKey": {
    "31003359": "dusklineinfrastructure",
    "31003360": "dusklineinfrastructure",
    "31003362": "dusklineinfrastructure",
    "31004922": "raialinfraabldeptteem",
    "31004923": "alvinmagre",
    "31004924": "moktarmomin",
    "31004925": "ravindrakapgade",
    "31004926": "pratimaenterprises",
    "31004997": "skmanglu",
    "31005044": "vecpl",
    "31005169": "anjalielectricalsdayashankar",
    "31005171": "lkelectricals",
    "31005172": "anjalielectricals",
    "31005174": "elicivprivatelimited",
    "31005195": "uttamelectrical",
    "31005260": "sunitaelectrical",
    "31005262": "pushpaelectricalscontractor",
    "31005306": "mangalmurti",
    "31005307": "manojkumarrai",
    "31005495": "jsrv",
    "31005497": "saikripa",
    "31005498": "mkinfra",
    "31005499": "prakashenterprises",
    "31005517": "skconstruction",
    "31005613": "amrutaelectricalcont",
    "31005614": "prajwallange",
    "31005615": "jaibalajienterprises",
    "31005616": "monishengineeringandsons",
    "31005617": "pohekarsonsnarendrababuraopohesar",
    "31005618": "frindsmultiservicescorporation",
    "31005619": "babaconstruction",
    "31005620": "roxorinfrastructuresprivatelimited",
    "31005621": "babaconstruction",
    "31005622": "sandipkumarray",
    "31005661": "bhagwaticonstruction",
    "31005662": "kerebabaenterprises",
    "31005685": "manojkumaryadav",
    "31005686": "manojkaumarmohto",
    "31005728": "raathbildicon",
    "31005766": "manaavelectricals",
    "31005767": "bramhankarelectricals",
    "31005768": "anvienterprises",
    "31005769": "rajconstruction",
    "31005828": "jpsupremeinfratech",
    "31005862": "eshtatraders",
    "31005885": "smgroup",
    "31005887": "araventerprises",
    "31005928": "mahakenterprises",
    "31005930": "pathanconstruction",
    "31005932": "jaimaavindhavasini",
    "31005981": "niteshnamdevabhare",
    "31006000": "vijaytradingcompany",
    "31006019": "shriladalijicontractor",
    "31006062": "shreebalajeecontractorsupplier",
    "31006105": "intallydynamix",
    "31006106": "gajrajenterprises",
    "31006107": "inayathusain",
    "31006108": "ravindrakapgate",
    "31006110": "nandkishorprabhakarselote",
    "31006111": "bhaskarashoksonware",
    "31006296": "shriramenterprises",
    "31006314": "adityaenterprisesdepartmental",
    "31006329": "utkarshenterprises",
    "31006343": "kalpvrikshaelectrical",
    "31006344": "dkelectrical",
    "31006345": "ranjeetsinghlodhi",
    "31006347": "maabhawaniconstruction",
    "31006363": "prashantelectrical",
    "31006364": "kavienterprises",
    "31006365": "saurabhdehariya",
    "31006555": "vcenterprises",
    "31006556": "rudraenterprises",
    "31006557": "newoneprojectsprivatelimited",
    "31006558": "priyankaelectricals",
    "31006559": "mdsconstruction",
    "31006572": "anuragibrothers",
    "31006573": "parvejaalamkhan",
    "31006574": "shrisawariyasethconstruction",
    "31006575": "subhadranarayanautombole",
    "31006606": "vishwakarmaenterprises",
    "31006785": "balukisandaeade",
    "31006786": "dsinfrastuacture",
    "31006817": "lodhiinfraprojectpvtltd",
    "31006829": "pradeepconstruction",
    "31006847": "ratanghoswamanlandge",
    "31006849": "hivrajmarashkolhe",
    "31006866": "saileshbhoyar",
    "31006869": "satendrasinghthekedar",
    "31006871": "thekedarsatyendrasingh",
    "31006930": "jaibalajienterprises2",
    "31006978": "shrijienterprises",
    "31007012": "parthenterises",
    "31007013": "samratenterprises",
    "31007014": "niharikaenterprises",
    "31007078": "ayanshenterprises",
    "31007079": "narayanconstruction",
    "31007082": "shivamenterprisesbuildingmaterial",
    "31007083": "balajiconstruction",
    "31007092": "shrishyamtraders",
    "31007122": "shrilaxmienterprises",
    "31007201": "nitinkesharaorandive",
    "31007223": "lodhicontractor",
    "31007236": "manohartraders",
    "31007244": "nityaenterprises",
    "31007269": "adityaenterprisesinfrawork",
    "31007389": "saienterprises",
    "31007398": "ayushelectricals",
    "31007408": "ramulaxmanwalthare",
    "31007460": "anilkumarmauriya",
    "31007467": "makalienterprise",
    "31007557": "anshumanenterprises",
    "31007558": "intallydynamixprivatelimited",
    "31007559": "ravindrakashiramkapgate",
    "31007560": "alkamanojramteke",
    "31007561": "bhaveshengineeringworks",
    "31007576": "snenterprise",
    "31007613": "abenterprises",
    "31007614": "chandanrajravindrakapgate",
    "31007641": "mangeshashoksonwanenew"
  },
  "groups": {
    "ravindrakapgade": {
      "key": "ravindrakapgade",
      "displayName": "Ravindra kapgade",
      "vendorCode": "500303597",
      "wos": [
        "31004925"
      ],
      "dhs": [
        "31004925",
        "31004925 MRN-04",
        "31004925 RAVINDRA KAPGATE",
        "31004925 MRN-27",
        "31004925 MDC-2232",
        "31004925 MRN-28",
        "31004925 MRN-25",
        "31004925 MDC-482",
        "31004925 MDC-1840",
        "31004925 MDC-1841",
        "31004925 MDC-1951",
        "31004925 MDC-159",
        "31004925 MDC-85",
        "31004925 MDC-1848",
        "31004925 MDC-525",
        "31004925 MDC-569",
        "31004925 MDC-468",
        "31004925 MDC-1919",
        "31004925 MDC-50",
        "31004925 MDC-47",
        "31004925 MDC-515",
        "31004925 MDC-494",
        "31004925 MDC-561",
        "31004925 MDC-2334",
        "31004925 MDC-353",
        "31004925 MDC-2207",
        "31004925 MDC-239",
        "31004925 MDC-141",
        "31004925 MDC-1889",
        "31004925 MDC-409",
        "31004925 MDC-312",
        "31004925 MDC-187",
        "31004925 MDC-171",
        "31004925 MDC-439",
        "31004925 MDC-425",
        "31004925 MDC-111",
        "31004925 MDC-438",
        "31004925 MDC-166",
        "31004925 MDC-220",
        "31004925 MDC-1921",
        "31004925 MDC-584",
        "31004925 MDC-489",
        "31004925 MDC-40",
        "31004925 MDC-428",
        "31004925 MDC-453",
        "31004925 MDC-1888",
        "31004925 MDC-405",
        "31004925 MDC-404",
        "RAVINDRA KAPGADE MDC-436",
        "RAVINDRA KAPGADE MDC-1802",
        "RAVINDRA KAPGADE MDC-1851",
        "RAVINDRA KAPGADE MDC-025",
        "SANDEEP KUMAR RAI MDC-183"
      ],
      "rawNorms": [
        "ravindrakapgade"
      ]
    },
    "pratimaenterprises": {
      "key": "pratimaenterprises",
      "displayName": "pratima Enterprises",
      "vendorCode": "500303597",
      "wos": [
        "31004926"
      ],
      "dhs": [
        "31004926"
      ],
      "rawNorms": [
        "pratimaenterprises"
      ]
    },
    "skmanglu": {
      "key": "skmanglu",
      "displayName": "S. K. manglu",
      "vendorCode": "500303597",
      "wos": [
        "31004997"
      ],
      "dhs": [
        "31004997",
        "31004997 MDC-44",
        "31004997 MDC-1872",
        "31004997 MDC-100",
        "31004997 MDC-1860",
        "31004997 MDC-1861",
        "MDC-46 W/O 31004997"
      ],
      "rawNorms": [
        "skmanglu"
      ]
    },
    "lkelectricals": {
      "key": "lkelectricals",
      "displayName": "LK Electricals",
      "vendorCode": "500303597",
      "wos": [
        "31005171"
      ],
      "dhs": [
        "31005171"
      ],
      "rawNorms": [
        "lkelectricals"
      ]
    },
    "anjalielectricals": {
      "key": "anjalielectricals",
      "displayName": "Anjali Electricals",
      "vendorCode": "500303597",
      "wos": [
        "31005172"
      ],
      "dhs": [
        "31005172"
      ],
      "rawNorms": [
        "anjalielectricals"
      ]
    },
    "elicivprivatelimited": {
      "key": "elicivprivatelimited",
      "displayName": "ELICIV Private Limited",
      "vendorCode": "500303597",
      "wos": [
        "31005174"
      ],
      "dhs": [
        "31005174"
      ],
      "rawNorms": [
        "elicivprivatelimited"
      ]
    },
    "dusklineinfrastructure": {
      "key": "dusklineinfrastructure",
      "displayName": "DUSKLINE INFRASTRUCTURE",
      "vendorCode": "500306505",
      "wos": [
        "31003359",
        "31003360",
        "31003362"
      ],
      "dhs": [
        "31003359",
        "31003360",
        "31003362"
      ],
      "rawNorms": [
        "dusklineinfrastructure"
      ]
    },
    "sunitaelectrical": {
      "key": "sunitaelectrical",
      "displayName": "Sunita Electrical",
      "vendorCode": "500303597",
      "wos": [
        "31005260"
      ],
      "dhs": [
        "31005260",
        "SUNITA ELECTRICLAS",
        "31005260 MDC-386",
        "31005260 MDC-552",
        "31005260 MDC-559",
        "31005260 MDC-314",
        "31005260 MDC-246",
        "31005260 MDC-616"
      ],
      "rawNorms": [
        "sunitaelectrical"
      ]
    },
    "pushpaelectricalscontractor": {
      "key": "pushpaelectricalscontractor",
      "displayName": "Pushpa Electricals & Contractor",
      "vendorCode": "500303597",
      "wos": [
        "31005262"
      ],
      "dhs": [
        "31005262"
      ],
      "rawNorms": [
        "pushpaelectricalscontractor"
      ]
    },
    "manojkumarrai": {
      "key": "manojkumarrai",
      "displayName": "MANOJ KUMAR RAI",
      "vendorCode": "500303597",
      "wos": [
        "31005307"
      ],
      "dhs": [
        "31005307"
      ],
      "rawNorms": [
        "manojkumarrai"
      ]
    },
    "mangalmurti": {
      "key": "mangalmurti",
      "displayName": "MANGAL MURTI",
      "vendorCode": "500303597",
      "wos": [
        "31005306"
      ],
      "dhs": [
        "31005306"
      ],
      "rawNorms": [
        "mangalmurti"
      ]
    },
    "vecpl": {
      "key": "vecpl",
      "displayName": "VECPL",
      "vendorCode": "500307891",
      "wos": [
        "31005044"
      ],
      "dhs": [
        "31005044"
      ],
      "rawNorms": [
        "vecpl"
      ]
    },
    "jsrv": {
      "key": "jsrv",
      "displayName": "J S R V",
      "vendorCode": "500303597",
      "wos": [
        "31005495"
      ],
      "dhs": [
        "31005495",
        "31005495 MDC-519",
        "31005495 MDC-487"
      ],
      "rawNorms": [
        "jsrv"
      ]
    },
    "saikripa": {
      "key": "saikripa",
      "displayName": "SAI KRIPA",
      "vendorCode": "500303597",
      "wos": [
        "31005497"
      ],
      "dhs": [
        "31005497"
      ],
      "rawNorms": [
        "saikripa"
      ]
    },
    "mkinfra": {
      "key": "mkinfra",
      "displayName": "MK. INFRA",
      "vendorCode": "500303597",
      "wos": [
        "31005498"
      ],
      "dhs": [
        "31005498",
        "31005498 MDC-463"
      ],
      "rawNorms": [
        "mkinfra"
      ]
    },
    "prakashenterprises": {
      "key": "prakashenterprises",
      "displayName": "PRAKASH ENTERPRISES",
      "vendorCode": "500303597",
      "wos": [
        "31005499"
      ],
      "dhs": [
        "31005499"
      ],
      "rawNorms": [
        "prakashenterprises"
      ]
    },
    "prajwallange": {
      "key": "prajwallange",
      "displayName": "PRAJWAL LANGE",
      "vendorCode": "500303597",
      "wos": [
        "31005614"
      ],
      "dhs": [
        "31005614"
      ],
      "rawNorms": [
        "prajwallange"
      ]
    },
    "amrutaelectricalcont": {
      "key": "amrutaelectricalcont",
      "displayName": "AMRUTA ELECTRICAL & CONT.",
      "vendorCode": "500303597",
      "wos": [
        "31005613"
      ],
      "dhs": [
        "31005613"
      ],
      "rawNorms": [
        "amrutaelectricalcont"
      ]
    },
    "sandipkumarray": {
      "key": "sandipkumarray",
      "displayName": "SANDIP KUMAR RAY",
      "vendorCode": "500303597",
      "wos": [
        "31005622"
      ],
      "dhs": [
        "31005622"
      ],
      "rawNorms": [
        "sandipkumarray"
      ]
    },
    "pohekarsonsnarendrababuraopohesar": {
      "key": "pohekarsonsnarendrababuraopohesar",
      "displayName": "POHEKAR & SONS     NARENDRA BABURAO POHESAR",
      "vendorCode": "500303597",
      "wos": [
        "31005617"
      ],
      "dhs": [
        "31005617",
        "31005617 MDC-452",
        "31005617 MDC-575",
        "31005617 MDC-531",
        "31005617 MDC-555",
        "31005617 MDC-490",
        "31005617 MDC-382"
      ],
      "rawNorms": [
        "pohekarsonsnarendrababuraopohesar"
      ]
    },
    "skconstruction": {
      "key": "skconstruction",
      "displayName": "S K CONSTRUCTION",
      "vendorCode": "500308075",
      "wos": [
        "31005517"
      ],
      "dhs": [
        "31005517"
      ],
      "rawNorms": [
        "skconstruction"
      ]
    },
    "bhagwaticonstruction": {
      "key": "bhagwaticonstruction",
      "displayName": "BHAGWATI CONSTRUCTION",
      "vendorCode": "500308057",
      "wos": [
        "31005661"
      ],
      "dhs": [
        "31005661"
      ],
      "rawNorms": [
        "bhagwaticonstruction"
      ]
    },
    "frindsmultiservicescorporation": {
      "key": "frindsmultiservicescorporation",
      "displayName": "FRINDS MULTISERVICES CORPORATION",
      "vendorCode": "500303597",
      "wos": [
        "31005618"
      ],
      "dhs": [
        "31005618"
      ],
      "rawNorms": [
        "frindsmultiservicescorporation"
      ]
    },
    "babaconstruction": {
      "key": "babaconstruction",
      "displayName": "BABA CONSTRUCTION",
      "vendorCode": "500303597",
      "wos": [
        "31005619",
        "31005621"
      ],
      "dhs": [
        "31005619",
        "31005621",
        "31005619 MDC-485"
      ],
      "rawNorms": [
        "babaconstruction",
        "babaconstructionvikashkumardubey"
      ]
    },
    "manojkaumarmohto": {
      "key": "manojkaumarmohto",
      "displayName": "MANOJ KAUMAR MOHTO",
      "vendorCode": "500303597",
      "wos": [
        "31005686"
      ],
      "dhs": [
        "31005686",
        "31005686 MDC-470"
      ],
      "rawNorms": [
        "manojkaumarmohto"
      ]
    },
    "roxorinfrastructuresprivatelimited": {
      "key": "roxorinfrastructuresprivatelimited",
      "displayName": "ROXOR INFRASTRUCTURES PRIVATE LIMITED",
      "vendorCode": "[object Object]",
      "wos": [
        "31005620"
      ],
      "dhs": [
        "31005620"
      ],
      "rawNorms": [
        "roxorinfrastructuresprivatelimited"
      ]
    },
    "jaibalajienterprises": {
      "key": "jaibalajienterprises",
      "displayName": "JAI BALAJI ENTERPRISES",
      "vendorCode": "500303597",
      "wos": [
        "31005615"
      ],
      "dhs": [
        "31005615"
      ],
      "rawNorms": [
        "jaibalajienterprises"
      ]
    },
    "kerebabaenterprises": {
      "key": "kerebabaenterprises",
      "displayName": "KERE BABA ENTERPRISES",
      "vendorCode": "500306390",
      "wos": [
        "31005662"
      ],
      "dhs": [
        "31005662"
      ],
      "rawNorms": [
        "kerebabaenterprises"
      ]
    },
    "manojkumaryadav": {
      "key": "manojkumaryadav",
      "displayName": "MANOJ KUMAR YADAV",
      "vendorCode": "500303597",
      "wos": [
        "31005685"
      ],
      "dhs": [
        "31005685",
        "31005685 MDC-379"
      ],
      "rawNorms": [
        "manojkumaryadav"
      ]
    },
    "monishengineeringandsons": {
      "key": "monishengineeringandsons",
      "displayName": "MONISH ENGINEERING AND SONS",
      "vendorCode": "500303597",
      "wos": [
        "31005616"
      ],
      "dhs": [
        "31005616"
      ],
      "rawNorms": [
        "monishengineeringandsons"
      ]
    },
    "bramhankarelectricals": {
      "key": "bramhankarelectricals",
      "displayName": "BRAMHANKAR ELECTRICALS",
      "vendorCode": "500303597",
      "wos": [
        "31005767"
      ],
      "dhs": [
        "31005767"
      ],
      "rawNorms": [
        "bramhankarelectricals"
      ]
    },
    "raathbildicon": {
      "key": "raathbildicon",
      "displayName": "RAATH BILDICON",
      "vendorCode": "500308115",
      "wos": [
        "31005728"
      ],
      "dhs": [
        "31005728"
      ],
      "rawNorms": [
        "raathbildicon"
      ]
    },
    "anvienterprises": {
      "key": "anvienterprises",
      "displayName": "ANVI ENTERPRISES",
      "vendorCode": "500303597",
      "wos": [
        "31005768"
      ],
      "dhs": [
        "31005768"
      ],
      "rawNorms": [
        "anvienterprises"
      ]
    },
    "rajconstruction": {
      "key": "rajconstruction",
      "displayName": "RAJ CONSTRUCTION",
      "vendorCode": "500303597",
      "wos": [
        "31005769"
      ],
      "dhs": [
        "31005769"
      ],
      "rawNorms": [
        "rajconstruction"
      ]
    },
    "mahakenterprises": {
      "key": "mahakenterprises",
      "displayName": "MAHAK ENTERPRISES",
      "vendorCode": "500303597",
      "wos": [
        "31005928"
      ],
      "dhs": [
        "31005928"
      ],
      "rawNorms": [
        "mahakenterprises"
      ]
    },
    "manaavelectricals": {
      "key": "manaavelectricals",
      "displayName": "MANAAV ELECTRICALS",
      "vendorCode": "500303597",
      "wos": [
        "31005766"
      ],
      "dhs": [
        "31005766"
      ],
      "rawNorms": [
        "manaavelectricals"
      ]
    },
    "jaimaavindhavasini": {
      "key": "jaimaavindhavasini",
      "displayName": "JAI MAA VINDHAVASINI",
      "vendorCode": "500308021",
      "wos": [
        "31005932"
      ],
      "dhs": [
        "31005932"
      ],
      "rawNorms": [
        "jaimaavindhavasini"
      ]
    },
    "niteshnamdevabhare": {
      "key": "niteshnamdevabhare",
      "displayName": "NITESH NAMDEV ABHARE",
      "vendorCode": "500303597",
      "wos": [
        "31005981"
      ],
      "dhs": [
        "31005981"
      ],
      "rawNorms": [
        "niteshnamdevabhare"
      ]
    },
    "eshtatraders": {
      "key": "eshtatraders",
      "displayName": "ESHTA TRADERS",
      "vendorCode": "500308185",
      "wos": [
        "31005862"
      ],
      "dhs": [
        "31005862"
      ],
      "rawNorms": [
        "eshtatraders"
      ]
    },
    "araventerprises": {
      "key": "araventerprises",
      "displayName": "ARAV ENTERPRISES",
      "vendorCode": "500414775",
      "wos": [
        "31005887"
      ],
      "dhs": [
        "31005887"
      ],
      "rawNorms": [
        "araventerprises"
      ]
    },
    "smgroup": {
      "key": "smgroup",
      "displayName": "S.M. GROUP",
      "vendorCode": "500416876",
      "wos": [
        "31005885"
      ],
      "dhs": [
        "31005885"
      ],
      "rawNorms": [
        "smgroup"
      ]
    },
    "jpsupremeinfratech": {
      "key": "jpsupremeinfratech",
      "displayName": "J.P. SUPREME INFRATECH",
      "vendorCode": "500308173",
      "wos": [
        "31005828"
      ],
      "dhs": [
        "31005828"
      ],
      "rawNorms": [
        "jpsupremeinfratech"
      ]
    },
    "pathanconstruction": {
      "key": "pathanconstruction",
      "displayName": "PATHAN CONSTRUCTION",
      "vendorCode": "500303597",
      "wos": [
        "31005930"
      ],
      "dhs": [
        "31005930"
      ],
      "rawNorms": [
        "pathanconstruction"
      ]
    },
    "vijaytradingcompany": {
      "key": "vijaytradingcompany",
      "displayName": "VIJAY TRADING COMPANY",
      "vendorCode": "500303597",
      "wos": [
        "31006000"
      ],
      "dhs": [
        "31006000"
      ],
      "rawNorms": [
        "vijaytradingcompany"
      ]
    },
    "shriladalijicontractor": {
      "key": "shriladalijicontractor",
      "displayName": "Shri Ladali Ji Contractor",
      "vendorCode": "500308255",
      "wos": [
        "31006019"
      ],
      "dhs": [
        "31006019"
      ],
      "rawNorms": [
        "shriladalijicontractor"
      ]
    },
    "gajrajenterprises": {
      "key": "gajrajenterprises",
      "displayName": "GAJRAJ ENTERPRISES",
      "vendorCode": "500303597",
      "wos": [
        "31006106"
      ],
      "dhs": [
        "31006106"
      ],
      "rawNorms": [
        "gajrajenterprises"
      ]
    },
    "inayathusain": {
      "key": "inayathusain",
      "displayName": "INAYAT HUSAIN",
      "vendorCode": "500303597",
      "wos": [
        "31006107"
      ],
      "dhs": [
        "31006107"
      ],
      "rawNorms": [
        "inayathusain"
      ]
    },
    "shreebalajeecontractorsupplier": {
      "key": "shreebalajeecontractorsupplier",
      "displayName": "Shree Bala Jee Contractor & Supplier",
      "vendorCode": "500308248",
      "wos": [
        "31006062"
      ],
      "dhs": [
        "31006062"
      ],
      "rawNorms": [
        "shreebalajeecontractorsupplier"
      ]
    },
    "intallydynamix": {
      "key": "intallydynamix",
      "displayName": "INTALLY DYNAMIX",
      "vendorCode": "500303597",
      "wos": [
        "31006105"
      ],
      "dhs": [
        "31006105"
      ],
      "rawNorms": [
        "intallydynamix"
      ]
    },
    "nandkishorprabhakarselote": {
      "key": "nandkishorprabhakarselote",
      "displayName": "NANDKISHOR PRABHAKAR SELOTE",
      "vendorCode": "500303597",
      "wos": [
        "31006110"
      ],
      "dhs": [
        "31006110"
      ],
      "rawNorms": [
        "nandkishorprabhakarselote"
      ]
    },
    "bhaskarashoksonware": {
      "key": "bhaskarashoksonware",
      "displayName": "BHASKAR ASHOK SONWARE",
      "vendorCode": "500303597",
      "wos": [
        "31006111"
      ],
      "dhs": [
        "31006111"
      ],
      "rawNorms": [
        "bhaskarashoksonware"
      ]
    },
    "ravindrakapgate": {
      "key": "ravindrakapgate",
      "displayName": "RAVINDRA KAPGATE",
      "vendorCode": "[object Object]",
      "wos": [
        "31006108"
      ],
      "dhs": [
        "31006108"
      ],
      "rawNorms": [
        "ravindrakapgate"
      ]
    },
    "shriramenterprises": {
      "key": "shriramenterprises",
      "displayName": "SHRI RAM ENTERPRISES",
      "vendorCode": "500303597",
      "wos": [
        "31006296"
      ],
      "dhs": [
        "31006296"
      ],
      "rawNorms": [
        "shriramenterprises"
      ]
    },
    "ranjeetsinghlodhi": {
      "key": "ranjeetsinghlodhi",
      "displayName": "RANJEET SINGH LODHI",
      "vendorCode": "500306274",
      "wos": [
        "31006345"
      ],
      "dhs": [
        "31006345"
      ],
      "rawNorms": [
        "ranjeetsinghlodhi"
      ]
    },
    "kalpvrikshaelectrical": {
      "key": "kalpvrikshaelectrical",
      "displayName": "Kalpvriksha Electrical",
      "vendorCode": "500303597",
      "wos": [
        "31006343"
      ],
      "dhs": [
        "31006343"
      ],
      "rawNorms": [
        "kalpvrikshaelectrical"
      ]
    },
    "dkelectrical": {
      "key": "dkelectrical",
      "displayName": "DK Electrical",
      "vendorCode": "500303597",
      "wos": [
        "31006344"
      ],
      "dhs": [
        "31006344"
      ],
      "rawNorms": [
        "dkelectrical"
      ]
    },
    "adityaenterprisesdepartmental": {
      "key": "adityaenterprisesdepartmental",
      "displayName": "ADITYA ENTERPRISES Departmental",
      "vendorCode": "500411387",
      "wos": [
        "31006314"
      ],
      "dhs": [
        "31006314"
      ],
      "rawNorms": [
        "adityaenterprisesdepartmental"
      ]
    },
    "prashantelectrical": {
      "key": "prashantelectrical",
      "displayName": "Prashant Electrical",
      "vendorCode": "500303597",
      "wos": [
        "31006363"
      ],
      "dhs": [
        "31006363"
      ],
      "rawNorms": [
        "prashantelectrical"
      ]
    },
    "kavienterprises": {
      "key": "kavienterprises",
      "displayName": "Kavi Enterprises",
      "vendorCode": "500303597",
      "wos": [
        "31006364"
      ],
      "dhs": [
        "31006364"
      ],
      "rawNorms": [
        "kavienterprises"
      ]
    },
    "saurabhdehariya": {
      "key": "saurabhdehariya",
      "displayName": "Saurabh Dehariya",
      "vendorCode": "500303597",
      "wos": [
        "31006365"
      ],
      "dhs": [
        "31006365"
      ],
      "rawNorms": [
        "saurabhdehariya"
      ]
    },
    "utkarshenterprises": {
      "key": "utkarshenterprises",
      "displayName": "UTKARSH ENTERPRISES",
      "vendorCode": "500303597",
      "wos": [
        "31006329"
      ],
      "dhs": [
        "31006329"
      ],
      "rawNorms": [
        "utkarshenterprises"
      ]
    },
    "maabhawaniconstruction": {
      "key": "maabhawaniconstruction",
      "displayName": "MAA BHAWANI CONSTRUCTION",
      "vendorCode": "500300277",
      "wos": [
        "31006347"
      ],
      "dhs": [
        "31006347"
      ],
      "rawNorms": [
        "maabhawaniconstruction"
      ]
    },
    "vcenterprises": {
      "key": "vcenterprises",
      "displayName": "V C Enterprises",
      "vendorCode": "500303597",
      "wos": [
        "31006555"
      ],
      "dhs": [
        "31006555"
      ],
      "rawNorms": [
        "vcenterprises"
      ]
    },
    "rudraenterprises": {
      "key": "rudraenterprises",
      "displayName": "Rudra Enterprises",
      "vendorCode": "[object Object]",
      "wos": [
        "31006556"
      ],
      "dhs": [
        "31006556"
      ],
      "rawNorms": [
        "rudraenterprises"
      ]
    },
    "newoneprojectsprivatelimited": {
      "key": "newoneprojectsprivatelimited",
      "displayName": "Newone Projects Private Limited",
      "vendorCode": "500303597",
      "wos": [
        "31006557"
      ],
      "dhs": [
        "31006557"
      ],
      "rawNorms": [
        "newoneprojectsprivatelimited"
      ]
    },
    "priyankaelectricals": {
      "key": "priyankaelectricals",
      "displayName": "Priyanka Electricals",
      "vendorCode": "[object Object]",
      "wos": [
        "31006558"
      ],
      "dhs": [
        "31006558"
      ],
      "rawNorms": [
        "priyankaelectricals"
      ]
    },
    "mdsconstruction": {
      "key": "mdsconstruction",
      "displayName": "MDS Construction",
      "vendorCode": "[object Object]",
      "wos": [
        "31006559"
      ],
      "dhs": [
        "31006559"
      ],
      "rawNorms": [
        "mdsconstruction"
      ]
    },
    "shrisawariyasethconstruction": {
      "key": "shrisawariyasethconstruction",
      "displayName": "M/S SHRI SAWARIYA SETH CONSTRUCTION",
      "vendorCode": "[object Object]",
      "wos": [
        "31006574"
      ],
      "dhs": [
        "31006574"
      ],
      "rawNorms": [
        "shrisawariyasethconstruction"
      ]
    },
    "anuragibrothers": {
      "key": "anuragibrothers",
      "displayName": "ANURAGI BROTHERS",
      "vendorCode": "500303597",
      "wos": [
        "31006572"
      ],
      "dhs": [
        "31006572"
      ],
      "rawNorms": [
        "anuragibrothers"
      ]
    },
    "parvejaalamkhan": {
      "key": "parvejaalamkhan",
      "displayName": "M/S PARVEJ AALAM KHAN",
      "vendorCode": "500303597",
      "wos": [
        "31006573"
      ],
      "dhs": [
        "31006573"
      ],
      "rawNorms": [
        "parvejaalamkhan"
      ]
    },
    "subhadranarayanautombole": {
      "key": "subhadranarayanautombole",
      "displayName": "SUBHADRA NARAYAN AUTOMBOLE",
      "vendorCode": "500303597",
      "wos": [
        "31006575"
      ],
      "dhs": [
        "31006575"
      ],
      "rawNorms": [
        "subhadranarayanautombole"
      ]
    },
    "vishwakarmaenterprises": {
      "key": "vishwakarmaenterprises",
      "displayName": "VISHWAKARMA ENTERPRISES",
      "vendorCode": "500307831",
      "wos": [
        "31006606"
      ],
      "dhs": [
        "31006606"
      ],
      "rawNorms": [
        "vishwakarmaenterprises"
      ]
    },
    "hivrajmarashkolhe": {
      "key": "hivrajmarashkolhe",
      "displayName": "HIVRAJ MARASHKOLHE",
      "vendorCode": "500303597",
      "wos": [
        "31006849"
      ],
      "dhs": [
        "31006849"
      ],
      "rawNorms": [
        "hivrajmarashkolhe"
      ]
    },
    "dsinfrastuacture": {
      "key": "dsinfrastuacture",
      "displayName": "D S INFRASTUACTURE",
      "vendorCode": "500308483",
      "wos": [
        "31006786"
      ],
      "dhs": [
        "31006786"
      ],
      "rawNorms": [
        "dsinfrastuacture"
      ]
    },
    "lodhiinfraprojectpvtltd": {
      "key": "lodhiinfraprojectpvtltd",
      "displayName": "LODHI INFRA PROJECT PVT LTD",
      "vendorCode": "500303597",
      "wos": [
        "31006817"
      ],
      "dhs": [
        "31006817"
      ],
      "rawNorms": [
        "lodhiinfraprojectpvtltd"
      ]
    },
    "ratanghoswamanlandge": {
      "key": "ratanghoswamanlandge",
      "displayName": "RATANGHOS WAMAN LANDGE",
      "vendorCode": "500303597",
      "wos": [
        "31006847"
      ],
      "dhs": [
        "31006847"
      ],
      "rawNorms": [
        "ratanghoswamanlandge"
      ]
    },
    "saileshbhoyar": {
      "key": "saileshbhoyar",
      "displayName": "SAILESH BHOYAR",
      "vendorCode": "500303597",
      "wos": [
        "31006866"
      ],
      "dhs": [
        "31006866"
      ],
      "rawNorms": [
        "saileshbhoyar"
      ]
    },
    "balukisandaeade": {
      "key": "balukisandaeade",
      "displayName": "BALUKISAN DAEADE",
      "vendorCode": "500303597",
      "wos": [
        "31006785"
      ],
      "dhs": [
        "31006785"
      ],
      "rawNorms": [
        "balukisandaeade"
      ]
    },
    "thekedarsatyendrasingh": {
      "key": "thekedarsatyendrasingh",
      "displayName": "THEKEDAR SATYENDRA SINGH",
      "vendorCode": "500308519",
      "wos": [
        "31006871"
      ],
      "dhs": [
        "31006871"
      ],
      "rawNorms": [
        "thekedarsatyendrasingh"
      ]
    },
    "satendrasinghthekedar": {
      "key": "satendrasinghthekedar",
      "displayName": "SATENDRA SINGH THEKEDAR",
      "vendorCode": "500308520",
      "wos": [
        "31006869"
      ],
      "dhs": [
        "31006869"
      ],
      "rawNorms": [
        "satendrasinghthekedar"
      ]
    },
    "samratenterprises": {
      "key": "samratenterprises",
      "displayName": "SAMRAT ENTERPRISES",
      "vendorCode": "[object Object]",
      "wos": [
        "31007013"
      ],
      "dhs": [
        "31007013"
      ],
      "rawNorms": [
        "samratenterprises"
      ]
    },
    "pradeepconstruction": {
      "key": "pradeepconstruction",
      "displayName": "Pradeep construction",
      "vendorCode": "500308511",
      "wos": [
        "31006829"
      ],
      "dhs": [
        "31006829"
      ],
      "rawNorms": [
        "pradeepconstruction"
      ]
    },
    "parthenterises": {
      "key": "parthenterises",
      "displayName": "PARTH ENTERISES",
      "vendorCode": "",
      "wos": [
        "31007012"
      ],
      "dhs": [
        "31007012"
      ],
      "rawNorms": [
        "parthenterises"
      ]
    },
    "jaibalajienterprises2": {
      "key": "jaibalajienterprises2",
      "displayName": "JAI BALAJI ENTERPRISES 2",
      "vendorCode": "",
      "wos": [
        "31006930"
      ],
      "dhs": [
        "31006930"
      ],
      "rawNorms": [
        "jaibalajienterprises2"
      ]
    },
    "shivamenterprisesbuildingmaterial": {
      "key": "shivamenterprisesbuildingmaterial",
      "displayName": "Shivam Enterprises & Building material",
      "vendorCode": "",
      "wos": [
        "31007082"
      ],
      "dhs": [
        "31007082"
      ],
      "rawNorms": [
        "shivamenterprisesbuildingmaterial"
      ]
    },
    "balajiconstruction": {
      "key": "balajiconstruction",
      "displayName": "M/s. Balaji Construction",
      "vendorCode": "",
      "wos": [
        "31007083"
      ],
      "dhs": [
        "31007083"
      ],
      "rawNorms": [
        "balajiconstruction"
      ]
    },
    "nitinkesharaorandive": {
      "key": "nitinkesharaorandive",
      "displayName": "Nitin Kesharao Randive",
      "vendorCode": "",
      "wos": [
        "31007201"
      ],
      "dhs": [
        "31007201"
      ],
      "rawNorms": [
        "nitinkesharaorandive"
      ]
    },
    "shrijienterprises": {
      "key": "shrijienterprises",
      "displayName": "Shriji Enterprises",
      "vendorCode": "",
      "wos": [
        "31006978"
      ],
      "dhs": [
        "31006978"
      ],
      "rawNorms": [
        "shrijienterprises"
      ]
    },
    "manohartraders": {
      "key": "manohartraders",
      "displayName": "Manohar Traders",
      "vendorCode": "",
      "wos": [
        "31007236"
      ],
      "dhs": [
        "31007236"
      ],
      "rawNorms": [
        "manohartraders"
      ]
    },
    "ayanshenterprises": {
      "key": "ayanshenterprises",
      "displayName": "Ayansh Enterprises",
      "vendorCode": "",
      "wos": [
        "31007078"
      ],
      "dhs": [
        "31007078"
      ],
      "rawNorms": [
        "ayanshenterprises"
      ]
    },
    "narayanconstruction": {
      "key": "narayanconstruction",
      "displayName": "Narayan Construction",
      "vendorCode": "",
      "wos": [
        "31007079"
      ],
      "dhs": [
        "31007079"
      ],
      "rawNorms": [
        "narayanconstruction"
      ]
    },
    "niharikaenterprises": {
      "key": "niharikaenterprises",
      "displayName": "NIHARIKA ENTERPRISES",
      "vendorCode": "",
      "wos": [
        "31007014"
      ],
      "dhs": [
        "31007014"
      ],
      "rawNorms": [
        "niharikaenterprises"
      ]
    },
    "lodhicontractor": {
      "key": "lodhicontractor",
      "displayName": "Lodhi Contractor",
      "vendorCode": "",
      "wos": [
        "31007223"
      ],
      "dhs": [
        "31007223"
      ],
      "rawNorms": [
        "lodhicontractor"
      ]
    },
    "ramulaxmanwalthare": {
      "key": "ramulaxmanwalthare",
      "displayName": "Ramu Laxman Walthare",
      "vendorCode": "",
      "wos": [
        "31007408"
      ],
      "dhs": [
        "31007408"
      ],
      "rawNorms": [
        "ramulaxmanwalthare"
      ]
    },
    "ayushelectricals": {
      "key": "ayushelectricals",
      "displayName": "Ayush Electricals",
      "vendorCode": "",
      "wos": [
        "31007398"
      ],
      "dhs": [
        "31007398"
      ],
      "rawNorms": [
        "ayushelectricals"
      ]
    },
    "shrishyamtraders": {
      "key": "shrishyamtraders",
      "displayName": "Shri Shyam Traders",
      "vendorCode": "",
      "wos": [
        "31007092"
      ],
      "dhs": [
        "31007092"
      ],
      "rawNorms": [
        "shrishyamtraders"
      ]
    },
    "anjalielectricalsdayashankar": {
      "key": "anjalielectricalsdayashankar",
      "displayName": "Anjali Electricals Dayashankar",
      "vendorCode": "",
      "wos": [
        "31005169"
      ],
      "dhs": [
        "31005169"
      ],
      "rawNorms": [
        "anjalielectricalsdayashankar"
      ]
    },
    "uttamelectrical": {
      "key": "uttamelectrical",
      "displayName": "Uttam Electrical",
      "vendorCode": "",
      "wos": [
        "31005195"
      ],
      "dhs": [
        "31005195"
      ],
      "rawNorms": [
        "uttamelectrical"
      ]
    },
    "raialinfraabldeptteem": {
      "key": "raialinfraabldeptteem",
      "displayName": "Raial Infra ABL Dept.Teem",
      "vendorCode": "",
      "wos": [
        "31004922"
      ],
      "dhs": [
        "31004922",
        "31004922 MDC-1837",
        "31004922 MDC-1847",
        "RAIAL INFRA MDC-1837"
      ],
      "rawNorms": [
        "raialinfraabldeptteem"
      ]
    },
    "moktarmomin": {
      "key": "moktarmomin",
      "displayName": "Moktar Momin",
      "vendorCode": "",
      "wos": [
        "31004924"
      ],
      "dhs": [
        "31004924",
        "MUKTAR MOMIN MDC-1846",
        "MUKTAR MOMIN MDC-2348",
        "MUKTAR MOMIN",
        "MUKTAR MOMIN MRN-106",
        "MUKHTAR MOMIN MDC-106",
        "MUKHTAR MOMIN",
        "MUKHTAR MOMIN MDC-67",
        "MUKHTAR MOMIN MDC-61"
      ],
      "rawNorms": [
        "moktarmomin"
      ]
    },
    "nityaenterprises": {
      "key": "nityaenterprises",
      "displayName": "Nitya Enterprises",
      "vendorCode": "",
      "wos": [
        "31007244"
      ],
      "dhs": [
        "31007244"
      ],
      "rawNorms": [
        "nityaenterprises"
      ]
    },
    "anilkumarmauriya": {
      "key": "anilkumarmauriya",
      "displayName": "Anil Kumar Mauriya",
      "vendorCode": "",
      "wos": [
        "31007460"
      ],
      "dhs": [
        "31007460"
      ],
      "rawNorms": [
        "anilkumarmauriya"
      ]
    },
    "makalienterprise": {
      "key": "makalienterprise",
      "displayName": "MA KALI ENTERPRISE",
      "vendorCode": "",
      "wos": [
        "31007467"
      ],
      "dhs": [
        "31007467"
      ],
      "rawNorms": [
        "makalienterprise"
      ]
    },
    "adityaenterprisesinfrawork": {
      "key": "adityaenterprisesinfrawork",
      "displayName": "ADITYA ENTERPRISES Infra work",
      "vendorCode": "",
      "wos": [
        "31007269"
      ],
      "dhs": [
        "31007269"
      ],
      "rawNorms": [
        "adityaenterprisesinfrawork"
      ]
    },
    "alvinmagre": {
      "key": "alvinmagre",
      "displayName": "Alvin Magre",
      "vendorCode": "",
      "wos": [
        "31004923"
      ],
      "dhs": [
        "31004923"
      ],
      "rawNorms": [
        "alvinmagre"
      ]
    },
    "anshumanenterprises": {
      "key": "anshumanenterprises",
      "displayName": "Anshuman Enterprises",
      "vendorCode": "",
      "wos": [
        "31007557"
      ],
      "dhs": [
        "31007557"
      ],
      "rawNorms": [
        "anshumanenterprises"
      ]
    },
    "intallydynamixprivatelimited": {
      "key": "intallydynamixprivatelimited",
      "displayName": "Intally Dynamix Private Limited",
      "vendorCode": "",
      "wos": [
        "31007558"
      ],
      "dhs": [
        "31007558"
      ],
      "rawNorms": [
        "intallydynamixprivatelimited"
      ]
    },
    "ravindrakashiramkapgate": {
      "key": "ravindrakashiramkapgate",
      "displayName": "Ravindra Kashiram Kapgate",
      "vendorCode": "",
      "wos": [
        "31007559"
      ],
      "dhs": [
        "31007559"
      ],
      "rawNorms": [
        "ravindrakashiramkapgate"
      ]
    },
    "alkamanojramteke": {
      "key": "alkamanojramteke",
      "displayName": "Alka Manoj Ramteke",
      "vendorCode": "",
      "wos": [
        "31007560"
      ],
      "dhs": [
        "31007560"
      ],
      "rawNorms": [
        "alkamanojramteke"
      ]
    },
    "bhaveshengineeringworks": {
      "key": "bhaveshengineeringworks",
      "displayName": "Bhavesh Engineering Works",
      "vendorCode": "",
      "wos": [
        "31007561"
      ],
      "dhs": [
        "31007561"
      ],
      "rawNorms": [
        "bhaveshengineeringworks"
      ]
    },
    "saienterprises": {
      "key": "saienterprises",
      "displayName": "Sai Enterprises",
      "vendorCode": "",
      "wos": [
        "31007389"
      ],
      "dhs": [
        "31007389"
      ],
      "rawNorms": [
        "saienterprises"
      ]
    },
    "shrilaxmienterprises": {
      "key": "shrilaxmienterprises",
      "displayName": "Shri Laxmi Enterprises",
      "vendorCode": "",
      "wos": [
        "31007122"
      ],
      "dhs": [
        "31007122"
      ],
      "rawNorms": [
        "shrilaxmienterprises"
      ]
    },
    "tallydynamix": {
      "key": "tallydynamix",
      "displayName": "TALLY DYNAMIX",
      "vendorCode": "",
      "wos": [],
      "dhs": [
        "TALLY DYNAMIX MDC-1832",
        "31004866 MDC-315",
        "TALLY DYNAMIX MDC-345",
        "TALLY DYNAMIX MDC-332"
      ],
      "rawNorms": [
        "tallydynamix"
      ]
    },
    "abenterprises": {
      "key": "abenterprises",
      "displayName": "M/s AB ENTERPRISES",
      "vendorCode": "",
      "wos": [
        "31007613"
      ],
      "dhs": [
        "31007613"
      ],
      "rawNorms": [
        "abenterprises"
      ]
    },
    "chandanrajravindrakapgate": {
      "key": "chandanrajravindrakapgate",
      "displayName": "M/s Chandanraj Ravindra Kapgate",
      "vendorCode": "",
      "wos": [
        "31007614"
      ],
      "dhs": [
        "31007614"
      ],
      "rawNorms": [
        "chandanrajravindrakapgate"
      ]
    },
    "mangeshashoksonwanenew": {
      "key": "mangeshashoksonwanenew",
      "displayName": "Mangesh Ashok Sonwane New",
      "vendorCode": "",
      "wos": [
        "31007641"
      ],
      "dhs": [
        "31007641"
      ],
      "rawNorms": [
        "mangeshashoksonwanenew"
      ]
    },
    "snenterprise": {
      "key": "snenterprise",
      "displayName": "SN ENTERPRISE",
      "vendorCode": "",
      "wos": [
        "31007576"
      ],
      "dhs": [
        "31007576"
      ],
      "rawNorms": [
        "snenterprise"
      ]
    }
  }
};
})(typeof window !== "undefined" ? window : global);
