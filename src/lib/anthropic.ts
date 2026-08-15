import Anthropic from '@anthropic-ai/sdk';

let singleton: Anthropic | null = null;

export function getAnthropic() {
	if (singleton) return singleton;
	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		throw new Error('ANTHROPIC_API_KEY not configured');
	}
	singleton = new Anthropic({ apiKey });
	return singleton;
}
