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

const testJobs = [
  {
    title: 'Digital Project Manager',
    department: 'Project Management',
    location: 'Buenos Aires, Buenos Aires, Argentina',
    description: `We are looking for a Digital Project Manager to join our team. You will work with multidisciplinary teams, using agile methodologies to deliver high-quality digital products.

The job proposal:
As a Digital Project Manager, you will be responsible for leading projects from conception to delivery, ensuring that all stakeholders are aligned and that projects are completed on time and within budget. You will work closely with UX/UI designers, developers, and clients to create exceptional digital experiences.

Your job responsibilities include:
- Creating project definitions and establishing clear objectives
- Planning sprints and managing project timelines
- Developing project materials and documentation
- Leading cross-functional teams
- Performing regular status updates and reporting
- Building and maintaining strong customer relations
- Managing project budgets and resources`,
    requirements: `What do we expect from you?
- 3+ years of experience as a project manager in software development or product design
- Experience working with multidisciplinary teams and Latam/US clients
- Familiarity with project management tools (Jira, Trello, Asana, etc.)
- Strong knowledge of agile methodologies (Scrum, Kanban)
- Excellent cross-functional communication and leadership skills
- Advanced English (a must)
- Passion for digital products and innovation
- Empathetic nature and strong negotiation skills

What are you going to find at Pow?
- Opportunity to work on products across different industries with direct client contact
- Spaces designed for feedback and continuous improvement
- Collaborative and supportive work environment
- Professional growth opportunities`,
    is_published: true,
  },
  {
    title: 'Lead Developer',
    department: 'Development',
    location: 'Buenos Aires, Buenos Aires, Argentina',
    description: `We are seeking an experienced Lead Developer to join our development team. You will be responsible for leading technical initiatives, mentoring junior developers, and building scalable web applications.

The job proposal:
As a Lead Developer, you will take ownership of technical decisions, architecture design, and code quality. You will work closely with product managers, designers, and other developers to deliver high-quality software solutions.

Your job responsibilities include:
- Leading development teams and technical initiatives
- Designing and implementing scalable architectures
- Code reviews and mentoring junior developers
- Collaborating with cross-functional teams
- Ensuring code quality and best practices
- Participating in technical decision-making`,
    requirements: `What do we expect from you?
- 5+ years of experience in software development
- Strong experience with modern JavaScript/TypeScript frameworks (React, Next.js, Node.js)
- Experience with cloud platforms (AWS, Vercel, etc.)
- Strong leadership and mentoring skills
- Excellent problem-solving abilities
- Advanced English
- Experience with agile methodologies`,
    is_published: true,
  },
  {
    title: 'Product Design Lead',
    department: 'Design',
    location: 'Buenos Aires, Ciudad Autónoma de Buenos Aires, Argentina',
    description: `We are looking for a Product Design Lead to drive our design strategy and create exceptional user experiences. You will lead a team of designers and work closely with product and engineering teams.

The job proposal:
As a Product Design Lead, you will be responsible for defining design strategy, creating user-centered designs, and leading design initiatives across multiple products. You will mentor designers and ensure design quality and consistency.

Your job responsibilities include:
- Leading design strategy and vision
- Creating user-centered designs and prototypes
- Leading and mentoring design teams
- Collaborating with product and engineering teams
- Conducting user research and usability testing
- Establishing design systems and guidelines`,
    requirements: `What do we expect from you?
- 5+ years of experience in product design
- Strong portfolio demonstrating UX/UI design skills
- Experience leading design teams
- Proficiency in design tools (Figma, Sketch, Adobe XD)
- Strong understanding of user research and usability testing
- Excellent communication and presentation skills
- Advanced English`,
    is_published: true,
  },
  {
    title: 'Product Designer',
    department: 'Design',
    location: 'Buenos Aires, Ciudad Autónoma de Buenos Aires, Argentina',
    description: `We are seeking a talented Product Designer to join our design team. You will work on creating beautiful and functional user interfaces for our digital products.

The job proposal:
As a Product Designer, you will be involved in all aspects of the design process, from research and ideation to final implementation. You will work closely with product managers, developers, and other designers to create exceptional user experiences.

Your job responsibilities include:
- Creating user interfaces and experiences
- Developing wireframes, prototypes, and high-fidelity designs
- Collaborating with cross-functional teams
- Participating in user research and testing
- Contributing to design system development`,
    requirements: `What do we expect from you?
- 3+ years of experience in product design
- Strong portfolio demonstrating UX/UI design skills
- Proficiency in design tools (Figma, Sketch, Adobe XD)
- Understanding of user-centered design principles
- Good communication and collaboration skills
- Intermediate to advanced English`,
    is_published: true,
  },
];

async function createTestJobs() {
  try {
    console.log('📝 Creating test jobs...\n');

    for (const job of testJobs) {
      // Check if job already exists
      const { data: existing } = await supabase
        .from('jobs')
        .select('id')
        .eq('title', job.title)
        .maybeSingle();

      if (existing) {
        console.log(`⏭️  Job "${job.title}" already exists, skipping...`);
        continue;
      }

      const { data, error } = await supabase
        .from('jobs')
        .insert(job)
        .select('id, title')
        .single();

      if (error) {
        console.error(`❌ Error creating job "${job.title}":`, error.message);
      } else {
        console.log(`✅ Created job: "${data.title}" (ID: ${data.id})`);
      }
    }

    console.log('\n✨ Test jobs creation completed!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createTestJobs();

