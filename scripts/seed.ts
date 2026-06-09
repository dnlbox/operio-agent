import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB = 'operio';

// ---------------------------------------------------------------------------
// Atlas Search index definitions — created programmatically if the driver
// supports it on Atlas M0; otherwise printed for manual creation in the UI.
// ---------------------------------------------------------------------------

const LEASES_SEARCH_INDEX = {
  name: 'leases_search',
  definition: {
    mappings: {
      dynamic: false,
      fields: {
        title: { type: 'string', analyzer: 'lucene.standard' },
        content: { type: 'string', analyzer: 'lucene.standard' },
        leaseId: { type: 'token' }
      }
    }
  }
};

const MANUALS_SEARCH_INDEX = {
  name: 'manuals_search',
  definition: {
    mappings: {
      dynamic: false,
      fields: {
        title: { type: 'string', analyzer: 'lucene.standard' },
        content: { type: 'string', analyzer: 'lucene.standard' },
        equipmentModel: { type: 'token' }
      }
    }
  }
};

const tenantsData = [
  {
    _id: 'tenant_001',
    storeName: 'Nike Store',
    unitNumber: 'Unit 104',
    sector: 'Sector B',
    managerName: 'Marcus Vance',
    contactEmail: 'marcus.vance@nike-mall.com',
    leaseId: 'lease_nike_104'
  },
  {
    _id: 'tenant_002',
    storeName: 'Adidas Store',
    unitNumber: 'Unit 105',
    sector: 'Sector B',
    managerName: 'Karen Smith',
    contactEmail: 'karen.smith@adidas.com',
    leaseId: 'lease_adidas_105'
  },
  {
    _id: 'tenant_003',
    storeName: 'Zara Store',
    unitNumber: 'Unit 106',
    sector: 'Sector A',
    managerName: 'Amancio Ortega',
    contactEmail: 'amancio.ortega@zara.com',
    leaseId: 'lease_zara_106'
  },
  {
    _id: 'tenant_004',
    storeName: 'Puma Store',
    unitNumber: 'Unit 107',
    sector: 'Sector B',
    managerName: 'Rudolf Dassler',
    contactEmail: 'rudolf.dassler@puma.com',
    leaseId: 'lease_puma_107'
  },
  {
    _id: 'tenant_005',
    storeName: 'Apple Store',
    unitNumber: 'Unit 108',
    sector: 'Sector A',
    managerName: 'Tim Cook',
    contactEmail: 'tcook@apple.com',
    leaseId: 'lease_apple_108'
  }
];

const staffData = [
  {
    _id: 'staff_001',
    name: 'Sarah Connor',
    skills: ['HVAC', 'Electrical'],
    status: 'Available',
    currentLocation: 'Sector B',
    shiftStart: '08:00',
    shiftEnd: '17:00',
    ratePerHour: 45.00
  },
  {
    _id: 'staff_002',
    name: 'John Connor',
    skills: ['Plumbing', 'Escalator'],
    status: 'Available',
    currentLocation: 'Sector A',
    shiftStart: '08:00',
    shiftEnd: '17:00',
    ratePerHour: 40.00
  }
];

/**
 * Parses markdown lease/manual files into section blocks.
 * @param filePath Path to the markdown file.
 * @returns Array of section contents.
 */
function parseMarkdownSections(filePath: string): string[] {
  const absolutePath = path.resolve(filePath);
  const content = fs.readFileSync(absolutePath, 'utf-8');

  // Split by markdown headers
  const sections = content.split(/(?=^##\s+)/m);
  return sections.map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Attempts to create an Atlas Search index via the driver API.
 * On Atlas M0 the createSearchIndex command may not be available;
 * if it fails we print the definition and instructions instead.
 */
async function ensureSearchIndex(
  db: ReturnType<MongoClient['db']>,
  collectionName: string,
  indexDef: { name: string; definition: object }
): Promise<void> {
  try {
    const collection = db.collection(collectionName);
    await collection.createSearchIndex({ name: indexDef.name, definition: indexDef.definition });
    console.log(`  Atlas Search index "${indexDef.name}" created on "${collectionName}".`);
  } catch (err: any) {
    const msg: string = err?.message ?? String(err);
    console.warn(`  Could not auto-create Atlas Search index "${indexDef.name}" on "${collectionName}": ${msg}`);
    console.warn('  Create it manually in the MongoDB Atlas UI:');
    console.warn(`  Collection: ${MONGO_DB}.${collectionName}`);
    console.warn(`  Index name: ${indexDef.name}`);
    console.warn('  Index definition JSON:');
    console.warn(JSON.stringify(indexDef.definition, null, 2));
    console.warn('  Steps: Atlas UI -> Your Cluster -> Search -> Create Search Index -> JSON Editor -> paste above.');
  }
}

async function seed() {
  console.log('--- Starting Database Seeding ---');

  console.log(`Connecting to MongoDB at ${MONGO_URI}...`);
  const mongoClient = new MongoClient(MONGO_URI);

  try {
    await mongoClient.connect();
    const db = mongoClient.db(MONGO_DB);

    // Clear and insert tenants
    console.log('Seeding "tenants" collection...');
    await db.collection('tenants').deleteMany({});
    await db.collection('tenants').insertMany(tenantsData as any[]);

    // Clear and insert staff
    console.log('Seeding "staff" collection...');
    await db.collection('staff').deleteMany({});
    await db.collection('staff').insertMany(staffData as any[]);

    // Clear and seed sessions
    console.log('Seeding "sessions" collection...');
    await db.collection('sessions').deleteMany({});
    const sessionData = [
      {
        _id: 'session_hvac_nike',
        tenantId: 'tenant_001',
        messages: [
          { role: 'user', content: 'Help, the storefront AC is blowing warm air! It is getting really hot inside.' },
          { role: 'model', content: 'I understand. I am running a check on your storefront HVAC system. Let me check the lease agreements first to see who is responsible for this repair.' },
          { role: 'model', content: 'According to Section 9.1 of your Nike Store lease agreement, the Landlord is responsible for major HVAC maintenance and repair. Since this is a central Carrier Model-50TJ system, I will proceed to find an available technician.' },
          { role: 'user', content: 'Great, please dispatch someone as soon as possible.' },
          { role: 'model', content: 'I have queried the active staff and Sarah Connor is available. I will create a work order and dispatch Sarah to your location.' }
        ]
      },
      {
        _id: 'session_plumb_adidas',
        tenantId: 'tenant_002',
        messages: [
          { role: 'user', content: 'Our main restroom sink is clogged and water is starting to overflow.' },
          { role: 'model', content: 'Acknowledged. Restroom plumbing blockages present a safety risk. Let me check the Adidas Store lease agreement.' },
          { role: 'model', content: 'Under Section 7.4 of the lease, plumbing blockages inside the retail unit are the responsibility of the Tenant. However, since the water is overflowing, I will auto-dispatch a technician to assist immediately. Note that this will be billed as a tenant chargeback.' },
          { role: 'user', content: 'Ok, please send them now, we will handle the cost.' },
          { role: 'model', content: 'I have dispatched John Connor to your location to resolve the plumbing clog.' }
        ]
      },
      {
        _id: 'session_lighting_nike',
        tenantId: 'tenant_001',
        messages: [
          { role: 'user', content: 'Our custom display lighting is flickering across two storefront zones and bulbs we replaced yesterday are already burning out again.' },
          { role: 'model', content: 'I am checking the Unit 104 lease because the fixtures may be tenant-owned while the upstream electrical panel may still belong to the landlord.' },
          { role: 'model', content: 'Section 9.2 says Nike maintains store fixtures, lamps, and drivers, but the landlord owns the upstream feeder and panel. Because multiple circuits are flickering and replacement lamps failed again, this may indicate a supply-side issue rather than isolated bulb failure.' },
          { role: 'user', content: 'Can you route the right inspection and note that we think it is more than just bulbs?' },
          { role: 'model', content: 'Yes. I am flagging this as an ambiguous electrical demarcation case so operations can inspect the feeder and panel before assigning final liability.' }
        ]
      },
      {
        _id: 'session_event_nike',
        tenantId: 'tenant_001',
        messages: [
          { role: 'user', content: 'We are planning a sneaker launch next Friday and expect a corridor line outside the store. What approvals do we need?' },
          { role: 'model', content: 'I am checking your lease for launch-event and queue-management rules before I advise next steps.' },
          { role: 'model', content: 'Section 13.1 requires landlord review at least 10 business days in advance for any event that may create a corridor queue or obstruct common-area circulation.' },
          { role: 'user', content: 'Can we place branded stanchions ourselves if the line gets large?' },
          { role: 'model', content: 'Not without written approval. The lease says Nike may not independently occupy corridor space or form exterior lines in common areas without landlord approval and an event operations plan.' }
        ]
      }
    ];
    await db.collection('sessions').insertMany(sessionData as any[]);

    // Clear and seed work orders
    console.log('Seeding "work_orders" collection...');
    await db.collection('work_orders').deleteMany({});
    const workOrdersData = [
      {
        tenantId: 'tenant_001',
        assetId: 'Carrier Model-50TJ',
        description: 'Storefront Carrier AC blowing warm air',
        costEstimation: 450,
        leaseResponsibility: 'Landlord',
        leaseClauseRef: 'Section 9.1',
        emergencyLevel: 'Routine',
        status: 'Dispatched',
        assignedTo: 'staff_001',
        sessionId: 'session_hvac_nike',
        externalSystemPayload: {
          source: 'Operio-Agent',
          externalId: 'WO-109482',
          action: 'CREATE_AND_DISPATCH',
          costCenter: 'Common-Area-Maintenance'
        },
        timeline: [
          {
            status: 'Created',
            timestamp: new Date(Date.now() - 3600000 * 2).toISOString()
          },
          {
            status: 'Dispatched',
            timestamp: new Date(Date.now() - 3600000).toISOString()
          }
        ]
      },
      {
        tenantId: 'tenant_002',
        assetId: 'Restroom Sink',
        description: 'Restroom sink clogged and overflowing',
        costEstimation: 250,
        leaseResponsibility: 'Tenant',
        leaseClauseRef: 'Section 7.4',
        emergencyLevel: 'Urgent',
        status: 'Dispatched',
        assignedTo: 'staff_002',
        sessionId: 'session_plumb_adidas',
        externalSystemPayload: {
          source: 'Operio-Agent',
          externalId: 'WO-994182',
          action: 'CREATE_AND_DISPATCH',
          costCenter: 'Tenant-Reimbursable'
        },
        timeline: [
          {
            status: 'Created',
            timestamp: new Date(Date.now() - 3600000).toISOString()
          },
          {
            status: 'Dispatched',
            timestamp: new Date().toISOString()
          }
        ]
      },
      {
        tenantId: 'tenant_001',
        assetId: 'Unit 104 Lighting / Panel Feed',
        description: 'Custom display lighting flickers across multiple storefront runs; repeated bulb burnout suggests upstream panel or feeder instability.',
        costEstimation: 275,
        leaseResponsibility: 'Unknown',
        leaseClauseRef: 'Section 9.2',
        emergencyLevel: 'Routine',
        status: 'Pending Approval',
        assignedTo: null,
        sessionId: 'session_lighting_nike',
        externalSystemPayload: {
          source: 'Operio-Agent',
          externalId: 'WO-771245',
          action: 'CREATE_AND_HOLD_FOR_DIAGNOSIS',
          costCenter: 'Liability-Pending-Demarcation'
        },
        timeline: [
          {
            status: 'Created',
            timestamp: new Date(Date.now() - 1800000).toISOString(),
            notes: 'Ambiguous liability between store-owned fixtures and landlord-owned upstream panel.'
          },
          {
            status: 'Pending Approval',
            timestamp: new Date(Date.now() - 900000).toISOString(),
            notes: 'Awaiting operations review before dispatching electrical inspection.'
          }
        ]
      }
    ];
    await db.collection('work_orders').insertMany(workOrdersData as any[]);

    // -----------------------------------------------------------------------
    // Seed leases and manuals into MongoDB collections (replaces ES indexing)
    // -----------------------------------------------------------------------

    const leaseFiles: Array<{ leaseId: string; titlePrefix: string; pdfUrl: string; file: string }> = [
      { leaseId: 'lease_nike_104',   titlePrefix: 'Nike Store Lease Section',    pdfUrl: '/assets/leases/lease_nike_104.pdf',   file: 'docs/mock_data/leases/nike-lease.md' },
      { leaseId: 'lease_adidas_105', titlePrefix: 'Adidas Store Lease Section',  pdfUrl: '/assets/leases/lease_adidas_105.pdf', file: 'docs/mock_data/leases/adidas-lease.md' },
      { leaseId: 'lease_zara_106',   titlePrefix: 'Zara Store Lease Section',    pdfUrl: '/assets/leases/lease_zara_106.pdf',   file: 'docs/mock_data/leases/zara-lease.md' },
      { leaseId: 'lease_puma_107',   titlePrefix: 'Puma Store Lease Section',    pdfUrl: '/assets/leases/lease_puma_107.pdf',   file: 'docs/mock_data/leases/puma-lease.md' },
      { leaseId: 'lease_apple_108',  titlePrefix: 'Apple Store Lease Section',   pdfUrl: '/assets/leases/lease_apple_108.pdf',  file: 'docs/mock_data/leases/apple-lease.md' },
    ];

    const manualFiles: Array<{ equipmentModel: string; titlePrefix: string; pdfUrl: string; file: string }> = [
      { equipmentModel: 'Carrier Model-50TJ',       titlePrefix: 'Carrier HVAC Manual Part',          pdfUrl: '/assets/manuals/carrier-hvac.pdf',          file: 'docs/mock_data/manuals/carrier-hvac.md' },
      { equipmentModel: 'Otis Model-NPE',            titlePrefix: 'Otis Escalator Manual Part',        pdfUrl: '/assets/manuals/otis-escalator.pdf',        file: 'docs/mock_data/manuals/otis-escalator.md' },
      { equipmentModel: 'Schindler Model-9300',      titlePrefix: 'Schindler Elevator Manual Part',    pdfUrl: '/assets/manuals/schindler-elevator.pdf',    file: 'docs/mock_data/manuals/schindler-elevator.md' },
      { equipmentModel: 'Rheem Model-Classic',       titlePrefix: 'Rheem HVAC Manual Part',            pdfUrl: '/assets/manuals/rheem-hvac.pdf',            file: 'docs/mock_data/manuals/rheem-hvac.md' },
      { equipmentModel: 'Honeywell Model-T6',        titlePrefix: 'Honeywell Thermostat Manual Part',  pdfUrl: '/assets/manuals/honeywell-thermostat.pdf',  file: 'docs/mock_data/manuals/honeywell-thermostat.md' },
      { equipmentModel: 'McQuay Model-WSC',          titlePrefix: 'McQuay Chiller Manual Part',        pdfUrl: '/assets/manuals/mcquay-chiller.pdf',        file: 'docs/mock_data/manuals/mcquay-chiller.md' },
      { equipmentModel: 'Culligan Model-HE',         titlePrefix: 'Culligan Softener Manual Part',     pdfUrl: '/assets/manuals/culligan-softener.pdf',     file: 'docs/mock_data/manuals/culligan-softener.md' },
      { equipmentModel: 'Lutron Model-Quantum',      titlePrefix: 'Lutron Lighting Manual Part',       pdfUrl: '/assets/manuals/lutron-lighting.pdf',       file: 'docs/mock_data/manuals/lutron-lighting.md' },
      { equipmentModel: 'Kone Model-TravelMaster',   titlePrefix: 'Kone Escalator Manual Part',        pdfUrl: '/assets/manuals/kone-escalator.pdf',        file: 'docs/mock_data/manuals/kone-escalator.md' },
      { equipmentModel: 'Generac Model-Protector',   titlePrefix: 'Generac Generator Manual Part',     pdfUrl: '/assets/manuals/generac-generator.pdf',     file: 'docs/mock_data/manuals/generac-generator.md' },
    ];

    console.log('Seeding "leases" collection...');
    await db.collection('leases').drop().catch(() => { /* collection may not exist yet */ });
    const leaseDocs: object[] = [];
    for (const { leaseId, titlePrefix, pdfUrl, file } of leaseFiles) {
      const sections = parseMarkdownSections(file);
      sections.forEach((content, i) => {
        leaseDocs.push({ leaseId, title: `${titlePrefix} ${i + 1}`, content, pdfUrl });
      });
    }
    if (leaseDocs.length > 0) {
      await db.collection('leases').insertMany(leaseDocs);
    }
    console.log(`  Inserted ${leaseDocs.length} lease sections.`);

    console.log('Seeding "manuals" collection...');
    await db.collection('manuals').drop().catch(() => { /* collection may not exist yet */ });
    const manualDocs: object[] = [];
    for (const { equipmentModel, titlePrefix, pdfUrl, file } of manualFiles) {
      const sections = parseMarkdownSections(file);
      sections.forEach((content, i) => {
        manualDocs.push({ equipmentModel, title: `${titlePrefix} ${i + 1}`, content, pdfUrl });
      });
    }
    if (manualDocs.length > 0) {
      await db.collection('manuals').insertMany(manualDocs);
    }
    console.log(`  Inserted ${manualDocs.length} manual sections.`);

    // -----------------------------------------------------------------------
    // Create Atlas Search indexes (best-effort; prints UI instructions on fail)
    // -----------------------------------------------------------------------
    console.log('Creating Atlas Search indexes...');
    await ensureSearchIndex(db, 'leases', LEASES_SEARCH_INDEX);
    await ensureSearchIndex(db, 'manuals', MANUALS_SEARCH_INDEX);

    console.log('MongoDB Seeding Completed successfully.');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoClient.close();
  }

  console.log('--- Database Seeding Complete ---');
}

seed();
