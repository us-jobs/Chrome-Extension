import { Queue, Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// BullMQ compatible connection config
const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null
};

// Create the main Sequence Execution Queue
export const sequenceQueue = new Queue('SequenceQueue', { connection });

// Job Types
interface SequenceJobData {
  contactId: string;
  sequenceId: string;
  stepId: string;
  stepType: 'EMAIL' | 'LINKEDIN_DM' | 'WAIT';
}

/**
 * Worker to process sequence steps asynchronously
 */
const sequenceWorker = new Worker('SequenceQueue', async (job: Job<SequenceJobData>) => {
  const { contactId, sequenceId, stepId, stepType } = job.data;
  
  console.log(`[SequenceEngine] Processing Job ${job.id}: Step ${stepId} (${stepType}) for Contact ${contactId}`);

  try {
    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact) throw new Error(`Contact ${contactId} not found`);

    switch (stepType) {
      case 'EMAIL':
        await handleEmailStep(contact);
        break;
      case 'LINKEDIN_DM':
        await handleLinkedInStep(contact);
        break;
      case 'WAIT':
        console.log(`[SequenceEngine] WAIT step hit. Should not process immediately.`);
        break;
      default:
        console.warn(`[SequenceEngine] Unknown step type: ${stepType}`);
    }

    // MOCK: In reality, we'd log the success to the Audit table here
    console.log(`[SequenceEngine] Successfully processed Job ${job.id}`);

  } catch (err: any) {
    console.error(`[SequenceEngine] Job ${job.id} failed:`, err.message);
    throw err; // triggers BullMQ retry logic
  }
}, { 
  connection: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  concurrency: 5 // Process 5 tasks at once
});

sequenceWorker.on('failed', (job, err) => {
  console.error(`[SequenceEngine] Job ${job?.id} failed out completely:`, err);
});

async function handleEmailStep(contact: any) {
  if (!contact.email) throw new Error(`Cannot send email - no email address on file`);
  
  // TODO: Integrate Resend.com or SendGrid API here
  console.log(`[SequenceEngine] 📧 PREPARING TO SEND EMAIL TO: ${contact.email}`);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  console.log(`[SequenceEngine] 📧✅ EMAIL SENT TO: ${contact.email}`);
}

async function handleLinkedInStep(contact: any) {
  if (!contact.linkedinUrl) throw new Error(`Cannot send LinkedIn DM - no URL on file`);
  
  // For LinkedIn DMs, we typically just queue up a task for the Chrome Extension to run when the user is active
  console.log(`[SequenceEngine] 👔 Queuing LinkedIn DM task for Extension: ${contact.linkedinUrl}`);
}
