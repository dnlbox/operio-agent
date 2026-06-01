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

    // Clear work orders
    console.log('Clearing "work_orders" collection...');
    await db.collection('work_orders').deleteMany({});

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
          content: nikeLeaseSections[i]
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
          content: adidasLeaseSections[i]
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
          content: carrierManualSections[i]
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
          content: otisManualSections[i]
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
