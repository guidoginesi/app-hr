import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function deleteAllData() {
  try {
    console.log('🗑️  Starting deletion of all candidates and jobs...\n');

    // 1. Delete all applications first (they reference both candidates and jobs)
    console.log('Deleting all applications...');
    const { data: applications, error: appsError } = await supabase
      .from('applications')
      .select('id');
    
    if (appsError) {
      console.error('Error fetching applications:', appsError);
    } else {
      if (applications && applications.length > 0) {
        const appIds = applications.map(a => a.id);
        const { error: deleteAppsError } = await supabase
          .from('applications')
          .delete()
          .in('id', appIds);
        
        if (deleteAppsError) {
          console.error('Error deleting applications:', deleteAppsError);
        } else {
          console.log(`✅ Deleted ${applications.length} applications`);
        }
      } else {
        console.log('✅ No applications to delete');
      }
    }

    // 2. Delete all candidates
    console.log('\nDeleting all candidates...');
    const { data: candidates, error: candidatesError } = await supabase
      .from('candidates')
      .select('id');
    
    if (candidatesError) {
      console.error('Error fetching candidates:', candidatesError);
    } else {
      if (candidates && candidates.length > 0) {
        const candidateIds = candidates.map(c => c.id);
        const { error: deleteCandidatesError } = await supabase
          .from('candidates')
          .delete()
          .in('id', candidateIds);
        
        if (deleteCandidatesError) {
          console.error('Error deleting candidates:', deleteCandidatesError);
        } else {
          console.log(`✅ Deleted ${candidates.length} candidates`);
        }
      } else {
        console.log('✅ No candidates to delete');
      }
    }

    // 3. Delete all jobs
    console.log('\nDeleting all jobs...');
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id');
    
    if (jobsError) {
      console.error('Error fetching jobs:', jobsError);
    } else {
      if (jobs && jobs.length > 0) {
        const jobIds = jobs.map(j => j.id);
        const { error: deleteJobsError } = await supabase
          .from('jobs')
          .delete()
          .in('id', jobIds);
        
        if (deleteJobsError) {
          console.error('Error deleting jobs:', deleteJobsError);
        } else {
          console.log(`✅ Deleted ${jobs.length} jobs`);
        }
      } else {
        console.log('✅ No jobs to delete');
      }
    }

    console.log('\n✨ All data deleted successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

deleteAllData();

