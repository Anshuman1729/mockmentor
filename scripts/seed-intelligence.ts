/**
 * Seed intelligence DB (question_bank + companies) with:
 *  - Generic questions parsed from CC0 Back-End-Developer-Interview-Questions repo
 *  - Company-specific questions Groq-generated for top 5 companies
 *
 * Run: npm run seed:intelligence
 */
import Groq from "groq-sdk";
import path from "path";
import fs from "fs";
import { neon } from "@neondatabase/serverless";

const BACKEND_DEV_README =
  process.env.BACKEND_DEV_README ||
  "/tmp/Back-End-Developer-Interview-Questions/README.md";
const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const DOMAIN_SEEDS = [
  {
    slug: "embedded_bms",
    name: "Embedded Systems / Battery Management Systems",
    description: "embedded C/C++, RTOS, CAN/SPI/I2C protocols, BMS algorithms (SOC/SOH estimation), power electronics, hardware-software co-design, firmware OTA updates",
  },
  {
    slug: "ml_ai_infra",
    name: "ML / AI Infrastructure",
    description: "model training pipelines, distributed training (PyTorch DDP, FSDP), MLOps, model serving, feature stores, vector databases, inference optimization (quantization, pruning, distillation)",
  },
  {
    slug: "data_platforms",
    name: "Data Platforms",
    description: "data warehousing (BigQuery, Snowflake, Redshift), streaming (Kafka, Flink, Spark), ETL/ELT pipelines, data modeling, lakehouse architecture, dbt, Apache Airflow",
  },
  {
    slug: "devops_platform",
    name: "DevOps / Platform Engineering",
    description: "Kubernetes, CI/CD pipelines, infrastructure as code (Terraform, Pulumi), SRE practices, observability (OpenTelemetry, Prometheus, Grafana), service mesh, GitOps",
  },
];

const TOP_COMPANIES = [
  { id: "google", name: "Google" },
  { id: "amazon", name: "Amazon" },
  { id: "microsoft", name: "Microsoft" },
  { id: "flipkart", name: "Flipkart" },
  { id: "uber", name: "Uber" },
];

const SECTION_ROUND_MAP: Record<string, string> = {
  design: "technical",
  patterns: "technical",
  languages: "technical",
  web: "technical",
  databases: "technical",
  nosql: "technical",
  codeversioning: "technical",
  concurrency: "technical",
  distributed: "technical",
  algorithms: "technical",
  architecture: "technical",
  soa: "technical",
  security: "technical",
  management: "behavioural",
  general: "behavioural",
  open: "behavioural",
  billgates: "behavioural",
  snippets: "technical",
};

interface ParsedQuestion {
  text: string;
  round_type: string;
}

interface EnrichedQuestion extends ParsedQuestion {
  ideal_keywords: string[];
  expected_signals: string[];
  difficulty: number;
  tags: string[];
}

// --- Phase A: Parse questions from README ---
function parseQuestionsFromREADME(filePath: string): ParsedQuestion[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const questions: ParsedQuestion[] = [];
  let roundType = "technical";
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const sectionMatch = line.match(/<a name='(\w+)'/);
    if (sectionMatch) {
      const slug = sectionMatch[1].toLowerCase();
      roundType = SECTION_ROUND_MAP[slug] ?? "technical";
    }

    if (line.startsWith("#### ")) {
      const title = line.slice(5).trim();
      const descLines: string[] = [];
      let j = i + 1;
      while (
        j < lines.length &&
        !lines[j].startsWith("####") &&
        !lines[j].startsWith("###")
      ) {
        const stripped = lines[j].trim();
        if (stripped && !stripped.startsWith("[") && !stripped.startsWith("<")) {
          descLines.push(stripped);
        }
        j++;
      }

      let text: string;
      if (descLines.length > 0) {
        text = descLines
          .slice(0, 3)
          .join(" ")
          .replace(/\[Resources\]\([^)]+\)/g, "")
          .replace(/<br\/?>/g, "")
          .trim()
          .slice(0, 500);
      } else {
        text = title + "?";
      }

      if (text.length > 20) {
        questions.push({ text, round_type: roundType });
      }
    }
    i++;
  }
  return questions;
}

function getGroqClient(): Groq {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY not set");
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

// --- Phase B: Groq enrichment (batch of up to 10) ---
async function enrichBatch(
  client: Groq,
  questions: ParsedQuestion[]
): Promise<EnrichedQuestion[]> {
  const numbered = questions
    .map((q, i) => `${i + 1}. ${q.text}`)
    .join("\n");

  const completion = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: "system",
        content: `You are a senior technical interviewer. Return raw JSON only — no markdown, no code blocks.`,
      },
      {
        role: "user",
        content: `Enrich these ${questions.length} interview questions with metadata.

Questions:
${numbered}

Return JSON in this exact format:
{
  "enriched": [
    {
      "index": 1,
      "ideal_keywords": ["3-5 key concepts an ideal answer covers"],
      "expected_signals": ["1-3 from: TECHNICAL_DEPTH, PROBLEM_SOLVING, STAR_ALIGNMENT, COMMUNICATION_SNR, RESULT_ORIENTATION, OWNERSHIP_ETHICS, ADAPTABILITY_GROWTH, EDGE_CASE_MASTERY"],
      "difficulty": 3,
      "tags": ["topic-tag-1", "topic-tag-2"]
    }
  ]
}

One object per question, index matches question number above. difficulty is 1-5.`,
      },
    ],
  });

  const raw = completion.choices[0].message.content?.trim() ?? "";
  const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const parsed = JSON.parse(jsonStr);

  type EnrichedItem = { index: number; ideal_keywords?: string[]; expected_signals?: string[]; difficulty?: number; tags?: string[] };
  const enrichedItems = parsed.enriched as EnrichedItem[];

  return questions.map((q, i) => {
    const e = enrichedItems.find((item) => item.index === i + 1);
    return {
      ...q,
      ideal_keywords: e?.ideal_keywords ?? [],
      expected_signals: e?.expected_signals ?? [],
      difficulty: e?.difficulty ?? 3,
      tags: e?.tags ?? [],
    };
  });
}

// Company-specific question generation
async function generateCompanyQuestions(
  client: Groq,
  companyName: string,
  roundType: string
): Promise<EnrichedQuestion[]> {
  const roundDesc =
    roundType === "technical"
      ? "system design, architecture, algorithms, or technical problem-solving specific to this company's scale and domain"
      : "STAR-format behavioral situations, leadership, culture fit, and team dynamics relevant to this company's values";

  const completion = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [
      {
        role: "system",
        content: `You are a senior ${companyName} interviewer. Return raw JSON only — no markdown.`,
      },
      {
        role: "user",
        content: `Generate 4 ${roundType} interview questions for a software engineer at ${companyName}.
Focus on: ${roundDesc}

Return:
{
  "questions": [
    {
      "question_text": "The complete question",
      "ideal_keywords": ["3-5 key terms"],
      "expected_signals": ["1-3 from: TECHNICAL_DEPTH, PROBLEM_SOLVING, STAR_ALIGNMENT, COMMUNICATION_SNR, RESULT_ORIENTATION, OWNERSHIP_ETHICS, ADAPTABILITY_GROWTH, EDGE_CASE_MASTERY"],
      "difficulty": 3,
      "tags": ["system-design", "leadership"]
    }
  ]
}`,
      },
    ],
  });

  const raw = completion.choices[0].message.content?.trim() ?? "";
  const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const parsed = JSON.parse(jsonStr);

  return ((parsed.questions ?? []) as Array<{ question_text: string; ideal_keywords?: string[]; expected_signals?: string[]; difficulty?: number; tags?: string[] }>).map((q) => ({
    text: q.question_text,
    round_type: roundType,
    ideal_keywords: q.ideal_keywords ?? [],
    expected_signals: q.expected_signals ?? [],
    difficulty: q.difficulty ?? 3,
    tags: q.tags ?? [],
  }));
}

// Phase D: Domain-specific question generation
async function generateDomainQuestions(
  client: Groq,
  domain: { slug: string; name: string; description: string },
  roundType: string
): Promise<EnrichedQuestion[]> {
  const roundDesc =
    roundType === "technical"
      ? `highly technical, domain-specific questions that a generic backend interviewer would NOT know to ask`
      : `STAR-format behavioral questions specific to challenges and culture of working in this domain`;

  const completion = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: "system",
        content: `You are a senior ${domain.name} interviewer. Return raw JSON only — no markdown.`,
      },
      {
        role: "user",
        content: `Generate 6 ${roundType} interview questions for a ${domain.name} engineer.
Domain context: ${domain.description}

Generate ${roundDesc}. Questions must require deep domain expertise.

Return:
{
  "questions": [
    {
      "question_text": "The complete question",
      "ideal_keywords": ["3-5 key domain-specific terms"],
      "expected_signals": ["1-3 from: TECHNICAL_DEPTH, PROBLEM_SOLVING, STAR_ALIGNMENT, COMMUNICATION_SNR, RESULT_ORIENTATION, OWNERSHIP_ETHICS, ADAPTABILITY_GROWTH, EDGE_CASE_MASTERY"],
      "difficulty": 4,
      "tags": ["domain-specific-tag"]
    }
  ]
}`,
      },
    ],
  });

  const raw = completion.choices[0].message.content?.trim() ?? "";
  const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const parsed = JSON.parse(jsonStr);

  return ((parsed.questions ?? []) as Array<{ question_text: string; ideal_keywords?: string[]; expected_signals?: string[]; difficulty?: number; tags?: string[] }>).map((q) => ({
    text: q.question_text,
    round_type: roundType,
    ideal_keywords: q.ideal_keywords ?? [],
    expected_signals: q.expected_signals ?? [],
    difficulty: q.difficulty ?? 4,
    tags: q.tags ?? [],
  }));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  const sql = neon(process.env.DATABASE_URL);
  const client = getGroqClient();

  // --- Phase A: Parse generic questions ---
  let genericQuestions: ParsedQuestion[] = [];
  if (fs.existsSync(BACKEND_DEV_README)) {
    genericQuestions = parseQuestionsFromREADME(BACKEND_DEV_README);
    console.log(
      `[parse] Extracted ${genericQuestions.length} questions from Back-End-Developer-Interview-Questions`
    );
  } else {
    console.warn(
      `[warn] README not found at ${BACKEND_DEV_README} — skipping generic questions`
    );
    console.warn(
      `       Clone with: git clone --depth=1 https://github.com/arialdomartini/Back-End-Developer-Interview-Questions.git /tmp/Back-End-Developer-Interview-Questions`
    );
  }

  // --- Phase B: Upsert generic company + enrich in batches ---
  await sql`INSERT INTO companies (id, name) VALUES ('generic', 'Generic') ON CONFLICT (id) DO NOTHING`;
  console.log("[company] Upserted: Generic");

  let totalInserted = 0;
  const BATCH_SIZE = 10;

  for (let i = 0; i < genericQuestions.length; i += BATCH_SIZE) {
    const batch = genericQuestions.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(genericQuestions.length / BATCH_SIZE);
    console.log(
      `[enrich] Batch ${batchNum}/${totalBatches} (${batch.length} questions)...`
    );

    try {
      const enriched = await enrichBatch(client, batch);
      for (const q of enriched) {
        await sql`
          INSERT INTO question_bank (company_id, question_text, round_type, tags, difficulty, ideal_keywords, expected_signals)
          VALUES ('generic', ${q.text}, ${q.round_type}, ${q.tags}, ${q.difficulty}, ${q.ideal_keywords}, ${q.expected_signals})
        `;
        totalInserted++;
      }
      console.log(`  [ok] inserted ${enriched.length}`);
    } catch (err) {
      console.error(`  [error] batch ${batchNum}:`, err);
    }

    if (i + BATCH_SIZE < genericQuestions.length) {
      await sleep(500);
    }
  }

  // --- Phase C: Company-specific questions for top companies ---
  console.log("\n[company-specific] Generating targeted questions for top companies...");

  for (const company of TOP_COMPANIES) {
    await sql`INSERT INTO companies (id, name) VALUES (${company.id}, ${company.name}) ON CONFLICT (id) DO NOTHING`;
    console.log(`\n[company] ${company.name}`);

    for (const roundType of ["technical", "behavioural"]) {
      try {
        console.log(`  [generating] ${roundType}...`);
        const questions = await generateCompanyQuestions(
          client,
          company.name,
          roundType
        );
        for (const q of questions) {
          await sql`
            INSERT INTO question_bank (company_id, question_text, round_type, tags, difficulty, ideal_keywords, expected_signals)
            VALUES (${company.id}, ${q.text}, ${q.round_type}, ${q.tags}, ${q.difficulty}, ${q.ideal_keywords}, ${q.expected_signals})
          `;
          totalInserted++;
        }
        console.log(`  [inserted] ${questions.length} questions`);
      } catch (err) {
        console.error(`  [error] ${company.name}/${roundType}:`, err);
      }
      await sleep(500);
    }
  }

  // --- Phase D: Domain-specific questions ---
  console.log("\n[domain] Generating domain-specific questions...");
  let domainInserted = 0;

  for (const domain of DOMAIN_SEEDS) {
    console.log(`\n[domain] ${domain.name}`);
    for (const roundType of ["technical", "behavioural"]) {
      try {
        console.log(`  [generating] ${roundType}...`);
        const questions = await generateDomainQuestions(client, domain, roundType);
        for (const q of questions) {
          await sql`
            INSERT INTO question_bank (company_id, question_text, round_type, domain, tags, difficulty, ideal_keywords, expected_signals)
            VALUES ('generic', ${q.text}, ${q.round_type}, ARRAY[${domain.slug}], ${q.tags}, ${q.difficulty}, ${q.ideal_keywords}, ${q.expected_signals})
          `;
          domainInserted++;
        }
        console.log(`  [inserted] ${questions.length} questions`);
      } catch (err) {
        console.error(`  [error] ${domain.name}/${roundType}:`, err);
      }
      await sleep(500);
    }
  }
  console.log(`\n[domain] Seeded ${domainInserted} domain questions.`);

  console.log(
    `\n✅ Done. Seeded ${totalInserted} generic+company questions + ${domainInserted} domain questions.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
