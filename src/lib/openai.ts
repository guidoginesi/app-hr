import OpenAI from 'openai';

let singleton: OpenAI | null = null;

export function getOpenAI() {
	if (singleton) return singleton;
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		throw new Error('OPENAI_API_KEY not configured');
	}
	singleton = new OpenAI({ apiKey });
	return singleton;
}


