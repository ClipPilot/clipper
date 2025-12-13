const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default API_URL;

// Welcome messages organized by time of day - tailored for AI video clipping & marketing
export const WELCOME_MESSAGES = {
  morning: [
    "Good morning, {name}! Ready to turn long videos into viral clips?",
    "Rise and shine, {name}! Let's create some scroll-stopping content today.",
    "Morning, {name}! Time to amplify your marketing reach.",
    "Good morning, {name}! Your next viral clip awaits.",
    "Hey {name}! Fresh start, fresh content. Let's clip it.",
    "Morning, {name}! Ready to make your content work harder?",
    "Good morning, {name}! Let AI handle the editing, you focus on the strategy.",
    "Hello {name}! Let's turn your videos into engagement machines.",
  ],
  afternoon: [
    "Good afternoon, {name}! How many clips have you created so far?",
    "Hey {name}! Ready to repurpose that content for social?",
    "Afternoon, {name}! Let's keep the content pipeline flowing.",
    "Welcome back, {name}! Time to maximize your video ROI.",
    "Hi {name}! Your audience is waiting for the next clip.",
    "Good afternoon, {name}! Let's multiply your content output.",
    "Hey there, {name}! One video, infinite marketing possibilities.",
    "Afternoon, {name}! Ready to dominate the algorithm?",
  ],
  evening: [
    "Good evening, {name}! Perfect time to batch-create some clips.",
    "Evening, {name}! Let's prep tomorrow's social content tonight.",
    "Hey {name}! Evening's the best time for content strategy.",
    "Good evening, {name}! Your marketing never sleeps, and neither does AI.",
    "Welcome back, {name}! Time to schedule that winning content.",
    "Evening, {name}! Let's turn today's footage into tomorrow's engagement.",
    "Hi {name}! Quiet hours = perfect clipping hours.",
    "Good evening, {name}! Ready to fill that content calendar?",
  ],
  night: [
    "Working late, {name}? Let's get that campaign content ready!",
    "Burning the midnight oil, {name}? AI's got your back.",
    "Hey {name}! Night owl marketers create the best content.",
    "Late night content creation, {name}? You're dedicated!",
    "Welcome back, {name}! The best marketers work when others sleep.",
    "Hi {name}! Prepping viral clips for the morning rush?",
    "Hey {name}! Late-night is prime time for content batching.",
    "Night mode activated, {name}! Let's clip while the world sleeps.",
  ],
};

export const getWelcomeMessage = (firstName: string): string => {
  const hour = new Date().getHours();
  let timeOfDay: keyof typeof WELCOME_MESSAGES;

  if (hour >= 5 && hour < 12) {
    timeOfDay = "morning";
  } else if (hour >= 12 && hour < 17) {
    timeOfDay = "afternoon";
  } else if (hour >= 17 && hour < 22) {
    timeOfDay = "evening";
  } else {
    timeOfDay = "night";
  }

  const messages = WELCOME_MESSAGES[timeOfDay];
  const randomMessage = messages[Math.floor(Math.random() * messages.length)];

  return randomMessage.replace("{name}", firstName);
};
