import type { AIProvider, ChatMessage } from "./provider";

interface ThemePattern {
  keywords: RegExp;
  responses: string[];
  inquiries: string[];
}

const THEMES: ThemePattern[] = [
  {
    keywords: /\b(anxious|anxiety|panic|racing|overthink|overthinking|worried|worry|spiraling|spinning)\b/i,
    responses: [
      "When thoughts start racing, they often make everything feel urgent and overwhelming. It makes complete sense that you're feeling depleted right now.",
      "Racing thoughts can feel like an avalanche where every worry triggers three more. I'm right here with you, and there's no rush to solve everything in this minute.",
      "That kind of mental momentum is really exhausting to carry. Let's give your mind permission to slow the tempo down, even just slightly.",
    ],
    inquiries: [
      "If you pause and take a gentle breath right now, what is the loudest thought asking for your attention?",
      "Can we set the future aside for just five quiet minutes? What does your body feel like in this moment?",
      "Is there one small piece of this that you can set down for tonight and revisit tomorrow with fresh eyes?",
    ],
  },
  {
    keywords: /\b(stress|stressed|overwhelm|overwhelmed|busy|exhausted|burnout|burned out|tired|drained|too much)\b/i,
    responses: [
      "Carrying too many responsibilities at once places an immense physical and emotional weight on your shoulders. It is completely reasonable to feel weary.",
      "It sounds like you've been running on high alert for a while, holding things together for everyone else. That takes a real toll.",
      "When you're swimming in obligations, even taking a pause can feel uncomfortable. But your rest is not something you have to earn.",
    ],
    inquiries: [
      "If you could take one expectation completely off your plate today without any guilt, which one would it be?",
      "Notice your shoulders and jaw right now — are you holding tension there? What happens if you let them soften a little?",
      "What is something small and quiet that would feel genuinely restorative to you in the next hour?",
    ],
  },
  {
    keywords: /\b(sad|down|crying|lonely|alone|empty|hopeless|depressed|heavy|hurting|grief)\b/i,
    responses: [
      "That sounds genuinely heavy to carry, and I'm really glad you reached out and put words to it. You don't have to put on a brave face here.",
      "Feeling lonely or weighed down can make the world feel quiet and far away. Your feelings are valid, and you don't have to carry them entirely in silence.",
      "Some days are just tender and hard. It's okay to feel low without trying to quickly cheer yourself up or rationalize it away.",
    ],
    inquiries: [
      "How long have you been holding onto this feeling by yourself?",
      "If you could wrap yourself in kindness right now instead of judgment, what would that look like?",
      "Is there someone in your life who has felt safe to talk to in the past, or would you like to stay here and reflect together?",
    ],
  },
  {
    keywords: /\b(sleep|insomnia|awake|bed|night|can't sleep|nightmare|restless)\b/i,
    responses: [
      "Nighttime has a way of magnifying every quiet worry when the rest of the world is asleep. It's frustrating when your mind refuses to wind down.",
      "Lying awake waiting for sleep often brings unnecessary pressure. Remember that even quiet resting with your eyes closed is still nourishing your body.",
      "The day is already done, and everything that happened is in the past. There is nothing that needs solving at this hour.",
    ],
    inquiries: [
      "Would it help to do a simple progressive relaxation together — releasing your forehead, jaw, and hands?",
      "If you wrote down whatever is spinning in your mind on a notepad beside you, would that allow you to let go of holding it?",
      "Would you like to talk through whatever is keeping you awake until your thoughts feel a little softer?",
    ],
  },
  {
    keywords: /\b(angry|mad|furious|frustrated|annoyed|unfair|resentful|conflict|argument)\b/i,
    responses: [
      "Frustration is often a signal that an important boundary has been crossed or something you deeply value wasn't respected. It makes sense why you're upset.",
      "It can be infuriating when situations feel outside your control or when people fail to meet reasonable expectations. Feeling that heat is completely natural.",
      "Anger has a lot of energy behind it. Letting yourself name the frustration here is much healthier than forcing it down or pretending it's fine.",
    ],
    inquiries: [
      "What part of this situation feels most unfair or hard to accept right now?",
      "Underneath the anger, is there any feeling of disappointment or hurt that also needs acknowledging?",
      "What is something you have control over right now that can protect your peace of mind?",
    ],
  },
  {
    keywords: /\b(good|great|happy|better|peaceful|grateful|calm|relaxed|relieved|progress)\b/i,
    responses: [
      "It is genuinely lovely to hear that there is some brightness and calm in your space today. Savoring these moments builds a reservoir of strength.",
      "Feeling lighter is something to welcome with open arms. It sounds like a steady rhythm is starting to settle in.",
      "Moments of ease are precious. Allowing yourself to simply enjoy feeling good without waiting for the other shoe to drop is a gift.",
    ],
    inquiries: [
      "What contributed to this sense of ease or clarity today?",
      "How can you anchor this feeling so you can return to it when things get noisier?",
      "What is one small thing you're appreciating right now in your surroundings?",
    ],
  },
  {
    keywords: /\b(hello|hi|hey|good morning|good evening|good afternoon|how are you|who are you|what can you do)\b/i,
    responses: [
      "Hello. It's good to meet you here. This is your quiet, private space to talk through whatever is on your mind.",
      "Welcome. Whether you have something specific you want to untangle or just need a mindful pause in your day, I'm here to listen.",
      "Hi there. Take a gentle breath and settle in. You can speak or write about whatever feels most present for you right now.",
    ],
    inquiries: [
      "How has today been treating your emotional energy so far?",
      "What is one thought or feeling that has been taking up space in your head today?",
      "Would you prefer to talk through something specific, or would you like to start with a gentle check-in?",
    ],
  },
];

const DEFAULT_RESPONSES = [
  "I hear you. Putting words to internal thoughts is often the first step in giving them room to breathe.",
  "Thank you for sharing that with me. It takes real honesty to look closely at what we're carrying inside.",
  "That makes a lot of sense. You don't have to carry every detail alone or figure it all out at once.",
];

const DEFAULT_INQUIRIES = [
  "How does it feel to say that out loud?",
  "When you sit with that thought for a moment, what feels like the most important piece of it?",
  "What would feel most supportive for you right now — exploring this deeper, or taking a grounding pause?",
];

export class MindfulProvider implements AIProvider {
  public readonly name = "Mindful Local";

  async generate(messages: ChatMessage[], _systemPrompt: string): Promise<string> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const text = lastUserMessage?.content?.trim() || "";

    // Check matched theme
    for (const theme of THEMES) {
      if (theme.keywords.test(text)) {
        const response = theme.responses[Math.floor(Math.random() * theme.responses.length)];
        const inquiry = theme.inquiries[Math.floor(Math.random() * theme.inquiries.length)];
        return `${response} ${inquiry}`;
      }
    }

    // Default gentle mindful reflection
    const resp = DEFAULT_RESPONSES[Math.floor(Math.random() * DEFAULT_RESPONSES.length)];
    const inq = DEFAULT_INQUIRIES[Math.floor(Math.random() * DEFAULT_INQUIRIES.length)];
    return `${resp} ${inq}`;
  }
}
