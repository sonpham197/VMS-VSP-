import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pqfzpcuqzfpaernwydao.supabase.co';
const supabaseAnonKey = 'sb_publishable_-QHP-kzHCZI0qgj8Fi-e9w_KEPpxTCk';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const generateRandomTrack = (vesselId, vesselName) => {
  const minLat = 9;
  const maxLat = 16;
  const minLng = 106;
  const maxLng = 112;

  // random coordinates
  const lat = Math.random() * (maxLat - minLat) + minLat;
  const lng = Math.random() * (maxLng - minLng) + minLng;
  const speed = Math.random() * 20 + 5; // 5 to 25 knots
  const heading = Math.random() * 360;
  const statuses = ['normal', 'normal', 'normal', 'warning', 'danger'];
  const status = statuses[Math.floor(Math.random() * statuses.length)];

  return {
    Vessel_id: vesselId,
    Vessel_name: vesselName,
    lat,
    lng,
    speed,
    heading,
    status,
    created_at: new Date().toISOString()
  };
};

const vesselsData = [
  {
    Vessel_id: 'PAN-992',
    Vessel_name: 'Ever Glory',
    IMO: '9841234',
    MMSI: '352888000',
    vessel_type: 'Container',
    flag: 'Panama',
    length_m: 400,
    width_m: 59,
    gross_tonnage: 219000,
    year_built: 2019
  },
  {
    Vessel_id: 'LIB-451',
    Vessel_name: 'MSC Oscar',
    IMO: '9703291',
    MMSI: '636016766',
    vessel_type: 'Container',
    flag: 'Liberia',
    length_m: 395,
    width_m: 59,
    gross_tonnage: 192240,
    year_built: 2014
  },
  {
    Vessel_id: 'SGP-202',
    Vessel_name: 'BW Pavilion',
    IMO: '9687069',
    MMSI: '563123450',
    vessel_type: 'LNG Tanker',
    flag: 'Singapore',
    length_m: 298,
    width_m: 46,
    gross_tonnage: 104100,
    year_built: 2015
  },
  {
    Vessel_id: 'MHL-888',
    Vessel_name: 'Front Altair',
    IMO: '9745902',
    MMSI: '538006880',
    vessel_type: 'Oil Tanker',
    flag: 'Marshall Islands',
    length_m: 250,
    width_m: 44,
    gross_tonnage: 62450,
    year_built: 2016
  },
  {
    Vessel_id: 'JPN-100',
    Vessel_name: 'Nippon Maru',
    IMO: '8911138',
    MMSI: '431444000',
    vessel_type: 'Passenger',
    flag: 'Japan',
    length_m: 166,
    width_m: 24,
    gross_tonnage: 22470,
    year_built: 1990
  },
  {
    Vessel_id: 'VNM-088',
    Vessel_name: 'Hải Âu 8',
    IMO: '9211020',
    MMSI: '574112233',
    vessel_type: 'Fishing',
    flag: 'Việt Nam',
    length_m: 35,
    width_m: 8,
    gross_tonnage: 200,
    year_built: 2008
  },
  {
    Vessel_id: 'CHN-999',
    Vessel_name: 'Zhen Hua 30',
    IMO: '9580455',
    MMSI: '413442110',
    vessel_type: 'Heavy Lift',
    flag: 'China',
    length_m: 297,
    width_m: 58,
    gross_tonnage: 82000,
    year_built: 2010
  },
  {
    Vessel_id: 'KOR-774',
    Vessel_name: 'Hyundai Pride',
    IMO: '9636967',
    MMSI: '440112000',
    vessel_type: 'Container',
    flag: 'South Korea',
    length_m: 366,
    width_m: 48,
    gross_tonnage: 142400,
    year_built: 2014
  },
  {
    Vessel_id: 'MYS-331',
    Vessel_name: 'Bunga Jasmine',
    IMO: '9182332',
    MMSI: '533221000',
    vessel_type: 'Chemical Tanker',
    flag: 'Malaysia',
    length_m: 170,
    width_m: 27,
    gross_tonnage: 24500,
    year_built: 1999
  },
  {
    Vessel_id: 'GRC-005',
    Vessel_name: 'Olympic Sea',
    IMO: '9376335',
    MMSI: '240567000',
    vessel_type: 'Bulk Carrier',
    flag: 'Greece',
    length_m: 225,
    width_m: 32,
    gross_tonnage: 40100,
    year_built: 2008
  }
];

async function seed() {
  console.log('Inserting 10 vessels...');
  const { data: vData, error: vError } = await supabase.from('vessels').insert(vesselsData).select();
  if (vError) {
    console.error('Error inserting vessels', vError);
    return;
  }
  console.log('Inserted vessels successfully!');

  console.log('Generating tracking data for the map...');
  const trackData = vesselsData.map(v => generateRandomTrack(v.Vessel_id, v.Vessel_name));
  
  const { data: tData, error: tError } = await supabase.from('vessel_tracks').insert(trackData).select();
  if (tError) {
    console.error('Error inserting tracks', tError);
    return;
  }
  console.log('Inserted tracks successfully!');
}

seed();
