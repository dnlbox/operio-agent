import { Client as ElasticClient } from '@elastic/elasticsearch';
import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB = 'operio';

const ELASTIC_URI = process.env.ELASTIC_URI || 'http://localhost:9200';

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

async function seed() {
  console.log('--- Starting Database Seeding ---');

  // 1. Seed MongoDB
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

    console.log('MongoDB Seeding Completed successfully.');
  } catch (error) {
    console.error('MongoDB Seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoClient.close();
  }

  // 2. Seed Elasticsearch
  console.log(`Connecting to Elasticsearch at ${ELASTIC_URI}...`);
  const elasticClient = new ElasticClient({ node: ELASTIC_URI });
  try {
    // Check connection
    await elasticClient.ping();

    // Recreate indexes
    const indexes = ['leases', 'manuals'];
    for (const index of indexes) {
      const exists = await elasticClient.indices.exists({ index });
      if (exists) {
        console.log(`Deleting existing index "${index}"...`);
        await elasticClient.indices.delete({ index });
      }
      console.log(`Creating index "${index}"...`);
      await elasticClient.indices.create({ index });
    }

    // Index Lease Files
    console.log('Indexing Lease agreements...');
    const nikeLeaseSections = parseMarkdownSections('docs/mock_data/leases/nike-lease.md');
    for (let i = 0; i < nikeLeaseSections.length; i++) {
      await elasticClient.index({
        index: 'leases',
        document: {
          leaseId: 'lease_nike_104',
          title: 'Nike Store Lease Section ' + (i + 1),
          content: nikeLeaseSections[i],
          pdfUrl: '/assets/leases/lease_nike_104.pdf'
        }
      });
    }

    const adidasLeaseSections = parseMarkdownSections('docs/mock_data/leases/adidas-lease.md');
    for (let i = 0; i < adidasLeaseSections.length; i++) {
      await elasticClient.index({
        index: 'leases',
        document: {
          leaseId: 'lease_adidas_105',
          title: 'Adidas Store Lease Section ' + (i + 1),
          content: adidasLeaseSections[i],
          pdfUrl: '/assets/leases/lease_adidas_105.pdf'
        }
      });
    }

    const zaraLeaseSections = parseMarkdownSections('docs/mock_data/leases/zara-lease.md');
    for (let i = 0; i < zaraLeaseSections.length; i++) {
      await elasticClient.index({
        index: 'leases',
        document: {
          leaseId: 'lease_zara_106',
          title: 'Zara Store Lease Section ' + (i + 1),
          content: zaraLeaseSections[i],
          pdfUrl: '/assets/leases/lease_zara_106.pdf'
        }
      });
    }

    const pumaLeaseSections = parseMarkdownSections('docs/mock_data/leases/puma-lease.md');
    for (let i = 0; i < pumaLeaseSections.length; i++) {
      await elasticClient.index({
        index: 'leases',
        document: {
          leaseId: 'lease_puma_107',
          title: 'Puma Store Lease Section ' + (i + 1),
          content: pumaLeaseSections[i],
          pdfUrl: '/assets/leases/lease_puma_107.pdf'
        }
      });
    }

    const appleLeaseSections = parseMarkdownSections('docs/mock_data/leases/apple-lease.md');
    for (let i = 0; i < appleLeaseSections.length; i++) {
      await elasticClient.index({
        index: 'leases',
        document: {
          leaseId: 'lease_apple_108',
          title: 'Apple Store Lease Section ' + (i + 1),
          content: appleLeaseSections[i],
          pdfUrl: '/assets/leases/lease_apple_108.pdf'
        }
      });
    }

    // Index Manual Files
    console.log('Indexing Equipment manuals...');
    const carrierManualSections = parseMarkdownSections('docs/mock_data/manuals/carrier-hvac.md');
    for (let i = 0; i < carrierManualSections.length; i++) {
      await elasticClient.index({
        index: 'manuals',
        document: {
          equipmentModel: 'Carrier Model-50TJ',
          title: 'Carrier HVAC Manual Part ' + (i + 1),
          content: carrierManualSections[i],
          pdfUrl: '/assets/manuals/carrier-hvac.pdf'
        }
      });
    }

    const otisManualSections = parseMarkdownSections('docs/mock_data/manuals/otis-escalator.md');
    for (let i = 0; i < otisManualSections.length; i++) {
      await elasticClient.index({
        index: 'manuals',
        document: {
          equipmentModel: 'Otis Model-NPE',
          title: 'Otis Escalator Manual Part ' + (i + 1),
          content: otisManualSections[i],
          pdfUrl: '/assets/manuals/otis-escalator.pdf'
        }
      });
    }

    const schindlerManualSections = parseMarkdownSections('docs/mock_data/manuals/schindler-elevator.md');
    for (let i = 0; i < schindlerManualSections.length; i++) {
      await elasticClient.index({
        index: 'manuals',
        document: {
          equipmentModel: 'Schindler Model-9300',
          title: 'Schindler Elevator Manual Part ' + (i + 1),
          content: schindlerManualSections[i],
          pdfUrl: '/assets/manuals/schindler-elevator.pdf'
        }
      });
    }

    const rheemManualSections = parseMarkdownSections('docs/mock_data/manuals/rheem-hvac.md');
    for (let i = 0; i < rheemManualSections.length; i++) {
      await elasticClient.index({
        index: 'manuals',
        document: {
          equipmentModel: 'Rheem Model-Classic',
          title: 'Rheem HVAC Manual Part ' + (i + 1),
          content: rheemManualSections[i],
          pdfUrl: '/assets/manuals/rheem-hvac.pdf'
        }
      });
    }

    const honeywellManualSections = parseMarkdownSections('docs/mock_data/manuals/honeywell-thermostat.md');
    for (let i = 0; i < honeywellManualSections.length; i++) {
      await elasticClient.index({
        index: 'manuals',
        document: {
          equipmentModel: 'Honeywell Model-T6',
          title: 'Honeywell Thermostat Manual Part ' + (i + 1),
          content: honeywellManualSections[i],
          pdfUrl: '/assets/manuals/honeywell-thermostat.pdf'
        }
      });
    }

    const mcquayManualSections = parseMarkdownSections('docs/mock_data/manuals/mcquay-chiller.md');
    for (let i = 0; i < mcquayManualSections.length; i++) {
      await elasticClient.index({
        index: 'manuals',
        document: {
          equipmentModel: 'McQuay Model-WSC',
          title: 'McQuay Chiller Manual Part ' + (i + 1),
          content: mcquayManualSections[i],
          pdfUrl: '/assets/manuals/mcquay-chiller.pdf'
        }
      });
    }

    const culliganManualSections = parseMarkdownSections('docs/mock_data/manuals/culligan-softener.md');
    for (let i = 0; i < culliganManualSections.length; i++) {
      await elasticClient.index({
        index: 'manuals',
        document: {
          equipmentModel: 'Culligan Model-HE',
          title: 'Culligan Softener Manual Part ' + (i + 1),
          content: culliganManualSections[i],
          pdfUrl: '/assets/manuals/culligan-softener.pdf'
        }
      });
    }

    const lutronManualSections = parseMarkdownSections('docs/mock_data/manuals/lutron-lighting.md');
    for (let i = 0; i < lutronManualSections.length; i++) {
      await elasticClient.index({
        index: 'manuals',
        document: {
          equipmentModel: 'Lutron Model-Quantum',
          title: 'Lutron Lighting Manual Part ' + (i + 1),
          content: lutronManualSections[i],
          pdfUrl: '/assets/manuals/lutron-lighting.pdf'
        }
      });
    }

    const koneManualSections = parseMarkdownSections('docs/mock_data/manuals/kone-escalator.md');
    for (let i = 0; i < koneManualSections.length; i++) {
      await elasticClient.index({
        index: 'manuals',
        document: {
          equipmentModel: 'Kone Model-TravelMaster',
          title: 'Kone Escalator Manual Part ' + (i + 1),
          content: koneManualSections[i],
          pdfUrl: '/assets/manuals/kone-escalator.pdf'
        }
      });
    }

    const generacManualSections = parseMarkdownSections('docs/mock_data/manuals/generac-generator.md');
    for (let i = 0; i < generacManualSections.length; i++) {
      await elasticClient.index({
        index: 'manuals',
        document: {
          equipmentModel: 'Generac Model-Protector',
          title: 'Generac Generator Manual Part ' + (i + 1),
          content: generacManualSections[i],
          pdfUrl: '/assets/manuals/generac-generator.pdf'
        }
      });
    }

    // Flush indexes to make docs available instantly
    await elasticClient.indices.refresh({ index: '_all' });
    console.log('Elasticsearch Seeding Completed successfully.');

  } catch (error) {
    console.error('Elasticsearch Seeding failed:', error);
    process.exit(1);
  }

  console.log('--- Database Seeding Complete ---');
}

seed();
