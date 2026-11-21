/**
 * @file Default Electrical Network Locations (Feeders / Substations / Divisions)
 * Official Master hierarchy: Division > Sub-Division > Substation > Feeder
 */
(function(root) {
  'use strict';

  // Stable 24-hex location IDs shared by the server and browser
  function makeId(div, sub, sst, fdr) {
    const raw = [div, sub, sst, fdr].map(value => String(value).normalize('NFKC').trim().replace(/\s+/g, ' ').replace(/\s*\/\s*/g, '/')).join('|').toLowerCase();
    // Deterministic 24-hex string using 3 independent 32-bit hashes
    let h1 = 0x811c9dc5, h2 = 0x41c64e6d, h3 = 0x9e3779b9;
    for (let i = 0; i < raw.length; i++) {
      const c = raw.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193);
      h2 = Math.imul(h2 ^ (c * (i + 1)), 0x5bd1e995);
      h3 = Math.imul(h3 ^ (c * (i + 7)), 0x1b873593);
    }
    const p1 = (h1 >>> 0).toString(16).padStart(8, '0');
    const p2 = (h2 >>> 0).toString(16).padStart(8, '0');
    const p3 = (h3 >>> 0).toString(16).padStart(8, '0');
    return 'loc_' + (p1 + p2 + p3).slice(0, 24);
  }

  const rawData = [
    { division: 'Gadchiroli', subDivision: 'Armori', substation: '33/11 KV ARMORI S/STN', feeder: '11KV Deulgaon FEEDER' },
    { division: 'Gadchiroli', subDivision: 'Armori', substation: '33/11 KV ARMORI S/STN', feeder: '11KV Darli FEEDER' },
    { division: 'Gadchiroli', subDivision: 'Armori', substation: '33/11 KV ARMORI S/STN', feeder: '11 KV Deulgaon(Gaothan) FEEDER' },
    { division: 'Gadchiroli', subDivision: 'Kurkheda', substation: '33/11 KV Kurkheda S/Stn', feeder: '11KV NANHI' },
    { division: 'Gadchiroli', subDivision: 'Kurkheda', substation: '33/11 KV Kurkheda S/Stn', feeder: '11KV ANDHALI' },
    { division: 'Gadchiroli', subDivision: 'Wadsa', substation: '33/11 KV Wadsa', feeder: '11KV Kondhala' },
    { division: 'Gadchiroli', subDivision: 'Wadsa', substation: '33/11 KV Shankarpur S/stn', feeder: '11KV Koregaon Feeder' },
    { division: 'Gadchiroli', subDivision: 'Kurkheda', substation: '33/11 KV Kadholi S/S', feeder: '11KV KHARKADA' },
    { division: 'Gadchiroli', subDivision: 'Gadchiroli', substation: '33/11 kv Porla S/STN', feeder: '11 Kv Porla New' },
    { division: 'Gadchiroli', subDivision: 'Gadchiroli', substation: '33/11 kv Porla S/STN', feeder: '11 Kv Sakhara' },
    { division: 'Gadchiroli', subDivision: 'Wadsa', substation: '33/11 KV SAWANGI (WADSA) S/stn', feeder: '11 KV SAWANGI FEEDER' },
    { division: 'Gadchiroli', subDivision: 'Gadchiroli', substation: '33/11 KV Semana S/STN', feeder: '11 Kv Wakadi' },
    { division: 'Gadchiroli', subDivision: 'Gadchiroli', substation: '33/11 KV GADCHIROLI', feeder: '11 KV GOGAON FEEDER' },
    { division: 'Gadchiroli', subDivision: 'Kurkheda', substation: '33/11 KV Kadholi S/S', feeder: '11KV KADHOLI' },
    { division: 'Gadchiroli', subDivision: 'Kurkheda', substation: '33/11 KV ANTARGAON S/Stn', feeder: '11KV PURADA' },
    { division: 'Gadchiroli', subDivision: 'Kurkheda', substation: '33 / 11 KV KADHOLI S/Stn', feeder: '11KV WASI' },
    { division: 'Gadchiroli', subDivision: 'Kurkheda', substation: '33/11 KV Kurkheda S/Stn', feeder: '11KV KUMBHITOLA' },
    { division: 'Gadchiroli', subDivision: 'Kurkheda', substation: '33/11 KV Kurkheda S/Stn', feeder: '11 KV Talegaon' },
    { division: 'Gadchiroli', subDivision: 'Armori', substation: '33/11 KV ARMORI S/STN', feeder: '11 KV JOGISAKHARA FEEDER' },
    { division: 'Gadchiroli', subDivision: 'Armori', substation: '33/11 KV DELANWADII S/STN', feeder: '11 KV WAIRAGAD FEEDER' },
    { division: 'Gadchiroli', subDivision: 'Armori', substation: '33/11 KV DELANWADII S/STN', feeder: '11 KV PISEWADADHA FEEDER' },
    { division: 'Gadchiroli', subDivision: 'Gadchiroli', substation: '33/11 KV AMIRZA S/STN', feeder: '11 KV AMIRZA' },
    { division: 'Gadchiroli', subDivision: 'Gadchiroli', substation: '33/11 KV AMIRZA S/STN', feeder: '11 KV MOUSHIKHAMB' },
    { division: 'Gadchiroli', subDivision: 'Gadchiroli', substation: '33/11 KV AMIRZA S/STN', feeder: '11 KV BAMNI' },
    { division: 'Gadchiroli', subDivision: 'Gadchiroli', substation: '33/11 KV GADCHIROLI', feeder: '11 KV BODHALI' },
    { division: 'Gadchiroli', subDivision: 'Gadchiroli', substation: '33/11 KV SAWELA', feeder: '11 KV GURWALA' },
    { division: 'Gadchiroli', subDivision: 'Kurkheda', substation: '33/11 KV MALEWADA', feeder: '11 KV ANGARA' },
    { division: 'Gadchiroli', subDivision: 'Kurkheda', substation: '33/11 KV MALEWADA', feeder: '11 KV SURSUNDI' },
    { division: 'Gadchiroli', subDivision: 'Kurkheda', substation: '33/11 KV MALEWADA', feeder: '11 KV MALEWADA' },
    { division: 'Gadchiroli', subDivision: 'Dhanora', substation: '33/11KV PENDHARI SUBSTATION', feeder: '11KV CHIMRIKAL' },
    { division: 'Gadchiroli', subDivision: 'Korchi', substation: '33/11 KV Korchi S/Stn', feeder: '11 KV BETHKATHI FEEDER' },
    { division: 'Gadchiroli', subDivision: 'Korchi', substation: '33/11 KV Korchi S/Stn', feeder: '11 KV KORCHI FEEDER' },
    { division: 'Gadchiroli', subDivision: 'Dhanora', substation: '33/11 KV CHATGAON SUBSTATION', feeder: 'CHATGAON NEW' },
    { division: 'Gadchiroli', subDivision: 'Korchi', substation: '33/11 KV Korchi S/Stn', feeder: '11 KV KOTARA FEEDER' },
    { division: 'Gadchiroli', subDivision: 'Dhanora', substation: '33/11 KV DHANORA S/SN', feeder: '11KV MURUMGAON ROAD' },
    { division: 'Gadchiroli', subDivision: 'Dhanora', substation: '33/11 KV DHANORA S/SN', feeder: '11KV RANGI' },
    { division: 'Gadchiroli', subDivision: 'Dhanora', substation: '33/11 KV CHATGAON SUBSTATION', feeder: 'KARWAFA' },
    { division: 'Gadchiroli', subDivision: 'Dhanora', substation: '33/11 KV DHANORA S/SN', feeder: '11KV CHATGAON' },
    { division: 'Gadchiroli', subDivision: 'Dhanora', substation: '33KV GATTA', feeder: '11KV PENDHARI' },
    { division: 'Bramhapuri', subDivision: 'Bramhapuri', substation: '33/11KV NANHORI', feeder: '11KV NANHORI' },
    { division: 'Bramhapuri', subDivision: 'Bramhapuri', substation: '33/11KV NANHORI', feeder: '11KV TORGAON' },
    { division: 'Bramhapuri', subDivision: 'Sindewahi', substation: '33/11KV NAWARGAON', feeder: '11KV ANTARGAON' },
    { division: 'Bramhapuri', subDivision: 'Sindewahi', substation: '33/11KV NAWARGAON', feeder: '11KV GIRGAON' },
    { division: 'Bramhapuri', subDivision: 'Sindewahi', substation: '33/11KV NAWARGAON', feeder: '11KV NACHANBHATTI' },
    { division: 'Bramhapuri', subDivision: 'Sindewahi', substation: '33/11KV NAWARGAON', feeder: '11KV GADBORI FEEDER' },
    { division: 'Bramhapuri', subDivision: 'Sindewahi', substation: '33/11KV NAWARGAON', feeder: '11KV ALESUR' },
    { division: 'Bramhapuri', subDivision: 'Nagbhid', substation: '33/11KV WALNI', feeder: '11KV SAWARGAON' },
    { division: 'Bramhapuri', subDivision: 'Nagbhid', substation: '33/11KV WALNI', feeder: '11KV KOJBI' },
    { division: 'Bramhapuri', subDivision: 'Nagbhid', substation: '33/11KV WALNI', feeder: '11KV BALAPUR' },
    { division: 'Bramhapuri', subDivision: 'Bramhapuri', substation: '33/11KV KINHI', feeder: '11KV KINHI (CHAUGHAN)' },
    { division: 'Bramhapuri', subDivision: 'Bramhapuri', substation: "33/11KV B' PURI (KHED)", feeder: '11KV KHED' },
    { division: 'Bramhapuri', subDivision: 'Bramhapuri', substation: "33/11KV B' PURI (KHED)", feeder: '11KV UDAPUR' },
    { division: 'Bramhapuri', subDivision: 'Nagbhid', substation: '33/11KV NAGBHID', feeder: '11KV KANPA' },
    { division: 'Bramhapuri', subDivision: 'Nagbhid', substation: '33/11KV NAGBHID', feeder: '11KV GHODAZARI' },
    { division: 'Bramhapuri', subDivision: 'Nagbhid', substation: '33/11KV NAGBHID', feeder: '11KV NAWEGAON PANDAV' },
    { division: 'Bramhapuri', subDivision: 'Nagbhid', substation: '33/11KV NAGBHID', feeder: '11KV MINDALA' },
    { division: 'Bramhapuri', subDivision: 'Sindewahi', substation: '33/11KV SINDEWAHI', feeder: '11KV NAWARGAON' },
    { division: 'Bramhapuri', subDivision: 'Sindewahi', substation: '33/11KV SINDEWAHI', feeder: '11KV SARADPAR' },
    { division: 'Bramhapuri', subDivision: 'Sindewahi', substation: '33/11KV SINDEWAHI', feeder: '11KV SIVANI' },
    { division: 'Bramhapuri', subDivision: 'Bramhapuri', substation: '33/11KV GANGALWADI', feeder: '11KV MENDKI' },
    { division: 'Bramhapuri', subDivision: 'Nagbhid', substation: '33/11KV MENDHA', feeder: '11KV MENDHA' },
    { division: 'Bramhapuri', subDivision: 'Nagbhid', substation: '33/11KV MENDHA', feeder: '11KV MOUSHI' },
    { division: 'Bramhapuri', subDivision: 'Nagbhid', substation: '33/11KV MENDHA', feeder: '11KV KOTGAON' },
    { division: 'Bramhapuri', subDivision: 'Sindewahi', substation: '33/11KV VYAHAD', feeder: '11KV NIFANDRA' },
    { division: 'Bramhapuri', subDivision: 'Sindewahi', substation: '33/11KV PATHARI', feeder: '11KV PATHARI TOWN' },
    { division: 'Bramhapuri', subDivision: 'Sindewahi', substation: '33/11KV PATHARI', feeder: '11KV GUNJEWAHI' },
    { division: 'Bramhapuri', subDivision: 'Bramhapuri', substation: '33/11KV HARDOLI', feeder: '11KV SAWALGAON' },
    { division: 'Allapalli', subDivision: 'Chamorshi', substation: '33/11KV Bhendala', feeder: '11KV bhendala' },
    { division: 'Allapalli', subDivision: 'Chamorshi', substation: '33/11KV yenapur', feeder: '11 KV yenapur' },
    { division: 'Allapalli', subDivision: 'Chamorshi', substation: '33/11KV yenapur', feeder: '11 Kv amboli' },
    { division: 'Allapalli', subDivision: 'Chamorshi', substation: '33/11KV yenapur', feeder: '11 Kv Jayrampur' },
    { division: 'Allapalli', subDivision: 'Sironcha', substation: '11 KV SIRONCHA SWITCH YARD', feeder: '11 KV ARDA' },
    { division: 'Allapalli', subDivision: 'Sironcha', substation: '11 KV SIRONCHA SWITCH YARD', feeder: '11 KV MADDIKUNTA' },
    { division: 'Allapalli', subDivision: 'Sironcha', substation: '33/11 KV ASARALLI SUBSTATION', feeder: '11KV SOMNOOR BALMUTYAMPALLI FE' },
    { division: 'Allapalli', subDivision: 'Sironcha', substation: '33 KV ANKISA', feeder: '11 KV Ankisa' },
    { division: 'Allapalli', subDivision: 'Sironcha', substation: '33 KV ANKISA', feeder: '11 KV WADDAM' },
    { division: 'Allapalli', subDivision: 'Sironcha', substation: '33 KV ANKISA', feeder: '11KV RANGDHAMPETHA FEEDER' },
    { division: 'Allapalli', subDivision: 'Chamorshi', substation: '33/11KV Chamorshi', feeder: '11KV Sonapur' },
    { division: 'Allapalli', subDivision: 'Chamorshi', substation: '33/11KV Talodhi', feeder: '11KV Talodhi' },
    { division: 'Allapalli', subDivision: 'Chamorshi', substation: '33/11KV Chamorshi', feeder: '11KV Ghot amgaon' },
    { division: 'Allapalli', subDivision: 'Sironcha', substation: '11 KV SIRONCHA SWITCH YARD', feeder: '11 KV MEDARAM' },
    { division: 'Allapalli', subDivision: 'Sironcha', substation: '33KV BAMNI', feeder: '11KV BAMNI' },
    { division: 'Allapalli', subDivision: 'Sironcha', substation: '33KV BAMNI', feeder: '11KV TEKADA' },
    { division: 'Allapalli', subDivision: 'Sironcha', substation: '33KV BAMNI', feeder: '11KV ZINGANOOR' },
    { division: 'Allapalli', subDivision: 'Chamorshi', substation: '33/11KV Adapalli', feeder: '11 KV Kalinagar' },
    { division: 'Allapalli', subDivision: 'Chamorshi', substation: '33/11KV Adapalli', feeder: '11KV Adpalii' },
    { division: 'Allapalli', subDivision: 'Chamorshi', substation: '33/11KV Adapalli', feeder: '11KV subhasgram' },
    { division: 'Allapalli', subDivision: 'Chamorshi', substation: '33/11KV Talodhi', feeder: '11 KV yedanur' },
    { division: 'Allapalli', subDivision: 'Chamorshi', substation: '33/11KV Talodhi', feeder: '11kv Kunghada' },
    { division: 'Allapalli', subDivision: 'Chamorshi', substation: '33/11KV Ghot', feeder: '11 Kv regadi' },
    { division: 'Allapalli', subDivision: 'Chamorshi', substation: '33/11KV Ghot', feeder: '11 KV Jagampur' },
    { division: 'Allapalli', subDivision: 'Chamorshi', substation: '33/11KV Ashti', feeder: '11 KV Markhanda' },
    { division: 'Allapalli', subDivision: 'Chamorshi', substation: '33/11KV Ashti', feeder: '11KV Illur' },
    { division: 'Allapalli', subDivision: 'Chamorshi', substation: '33/11KV Ashti', feeder: '11KV Ashti' },
    { division: 'Allapalli', subDivision: 'Chamorshi', substation: '33/11KV Regadi', feeder: '11 KV Vikaspalli' },
    { division: 'Allapalli', subDivision: 'Mulchera', substation: 'Mulchera', feeder: '11 KV SunderNagar' },
    { division: 'Allapalli', subDivision: 'Mulchera', substation: 'Mulchera', feeder: '11 KV Koparali' },
    { division: 'Allapalli', subDivision: 'Mulchera', substation: 'Mulchera', feeder: '11 KV Mulchera' },
    { division: 'Allapalli', subDivision: 'Sironcha', substation: '33/11 KV ASARALLI SUBSTATION', feeder: '11KV Patagudam' },
    { division: 'Allapalli', subDivision: 'Allapalli', substation: '33/11KV Lagam', feeder: '11KV Lagam' },
    { division: 'Allapalli', subDivision: 'Allapalli', substation: '33/11KV Lagam', feeder: '11KVMallera' },
    { division: 'Allapalli', subDivision: 'Allapalli', substation: '33/11KV Lagam', feeder: '11KVBori' },
    { division: 'Allapalli', subDivision: 'Etapalli', substation: '33/11KV Ettapalli', feeder: '11kvBhamaragad' },
    { division: 'Allapalli', subDivision: 'Bhamragad', substation: 'Bhamaragad', feeder: '11 KV Kothi' },
    { division: 'Allapalli', subDivision: 'Allapalli', substation: '66/11KV Jimalgatta', feeder: '11KV Umanoor' }
  ];

  const defaultFeeders = rawData.map(function(item, index) {
    const id = makeId(item.division, item.subDivision, item.substation, item.feeder);
    const fullName = item.feeder + ' — ' + item.substation + ' (' + item.subDivision + ', ' + item.division + ')';
    return {
      id: id,
      name: fullName,
      division: item.division,
      subDivision: item.subDivision,
      substation: item.substation,
      feeder: item.feeder,
      sortOrder: index + 1,
      isDefault: true
    };
  });

  const defaultFeedersById = {};
  defaultFeeders.forEach(function(f) {
    defaultFeedersById[f.id] = f;
  });

  const DefaultFeedersModule = {
    list: defaultFeeders,
    byId: defaultFeedersById,
    get: function(id) {
      return defaultFeedersById[id] || null;
    },
    divisions: ['Gadchiroli', 'Bramhapuri', 'Allapalli'],
    getSubDivisions: function(division) {
      const set = new Set();
      defaultFeeders.forEach(function(f) {
        if (!division || f.division === division) set.add(f.subDivision);
      });
      return Array.from(set).sort();
    },
    getSubstations: function(division, subDivision) {
      const set = new Set();
      defaultFeeders.forEach(function(f) {
        if ((!division || f.division === division) && (!subDivision || f.subDivision === subDivision)) {
          set.add(f.substation);
        }
      });
      return Array.from(set).sort();
    },
    getFeeders: function(division, subDivision, substation) {
      return defaultFeeders.filter(function(f) {
        if (division && f.division !== division) return false;
        if (subDivision && f.subDivision !== subDivision) return false;
        if (substation && f.substation !== substation) return false;
        return true;
      });
    }
  };

  root.DefaultFeeders = DefaultFeedersModule;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DefaultFeedersModule;
  }
})(typeof window !== 'undefined' ? window : globalThis);
