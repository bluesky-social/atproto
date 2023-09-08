import ogArtificialBrainsB64 from './img/og-artificial-brains-b64'
import embedSunsetB64 from './img/embed-sunset-b64'
import embedAbandonFactoryB64 from './img/embed-abandon-factory-b64'

interface DefaultPost {
  text: string
  replies: DefaultPost[]
}

export interface LongPost {
  text: string
  image?: string
  external?: { uri: string; title: string; description: string; thumb?: string }
}

interface DemoPost extends LongPost {
  group: string
  user: string
  replies: DefaultPost[]
}

export const demoPosts: DemoPost[] = [
  {
    group: 'aimagiceveryday.group',
    user: 'dave.test',
    text: `Just read an eye-opening article about the link between artificial neural networks (ANNs) and our own brains.

    ANNs aren't carbon copies of our brains, but they're unveiling incredible insights into brain functions. For instance, ANNs designed for image recognition share uncanny similarities with how our brains operate. And in the realms of speech and language, ANNs mimic our brain's sound processing.
    
    The mind-blowing part? An ANN "seeing" through human eyes using MRI data, grasping visuals much like our brains do. This could be a game-changer for brain-computer interfaces, especially aiding visually impaired individuals.
    
    I'm curious to know how you think these connections between AI and the brain will impact other areas like education, language learning, and even art and creativity. Any exciting ideas?
    ""When Dr Yamins and his colleagues compared what was going on inside the macaque brains to the silicon ones, they found arresting parallels between how the monkeys represented images and how the computers did.`,
    external: {
      uri: 'https://www.economist.com/science-and-technology/2023/05/24/artificial-brains-are-helping-scientists-study-the-real-thing',
      title: 'Artificial brains are helping scientists study the real thing',
      description: `No model is perfect. But that doesn't stop them being useful`,
      thumb: ogArtificialBrainsB64,
    },
    replies: [
      {
        text: `"The cross-pollination of ideas between AI and neuroscience is inspiring. It reminds me that innovation often comes from unexpected places. Who knows what other scientific frontiers could benefit from this kind of collaboration?"`,
        replies: [
          {
            text: `"As someone who works in personalized medicine, I'm excited by the potential for AI and neuroscience to revolutionize healthcare. With the ability to analyze individual patients' unique biology and develop tailored treatments, we could see major improvements in patient outcomes and cost-effectiveness. I'm especially passionate about the ways this could help patients get the most effective and personalized care possible."`,
            replies: [],
          },
        ],
      },
      {
        text: `"It's like we're reverse-engineering our brains with the help of technology. The future of cognitive science looks bright!"`,
        replies: [],
      },
    ],
  },
  {
    group: 'thephototriothatrules.group',
    user: 'kira.test',
    text: `This evening, I had the pleasure of witnessing a gorgeous sunset, and I'd love to share some of the photography techniques I used to capture its splendor. The golden hour light bathed everything in a warm, honey-like glow, which I accentuated by carefully framing the scene and balancing the exposure. After a bit of experimenting with filters and other effects, I was able to achieve the perfect balance of color and contrast. It was a truly magical experience!`,
    image: embedSunsetB64,
    replies: [
      {
        text: `Wow, your sunset shot is incredible! 😍 Could you tell us which filters you used and how you managed the exposure to get those vibrant colors without overexposing the sun? I've been struggling with that in my sunset shots lately.`,
        replies: [],
      },
      {
        text: `Your photo is stunning!`,
        replies: [],
      },
    ],
  },
  {
    group: 'thephototriothatrules.group',
    user: 'kira.test',
    text: `I had the chance to explore an abandoned factory, and the experience was like stepping back in time. I photographed the rusted machinery, peeling paint, and shadowy corners, taking care to highlight the intricate details and moody atmosphere. Low-light photography can be a challenge, but it's also incredibly rewarding. Have you had any similar experiences photographing unique or historic locations?`,
    image: embedAbandonFactoryB64,
    replies: [],
  },
  {
    group: 'smarthomegadgets.group',
    user: 'aman.test',
    text: `Just installed the Ezviz Wi-Fi video doorbell at my place, and it's a game-changer!

    No more guessing who's at the door - now I can see and chat with visitors from the comfort of my couch. It also records footage of anyone approaching my door when I'm away. 
    
    It's affordable, records in HD, and works with Alexa and Google Assistant`,
    replies: [
      {
        text: `I've been thinking about getting a video doorbell for a while now, and your experience with the Ezviz is really convincing. Thanks for sharing your recommendation!`,
        replies: [],
      },
    ],
  },
  // {
  //   group: 'aimagiceveryday.group',
  //   text: `There's a tension between AI safety and concentration of power that we need to recognize in order to be having healthy conversations. It may be that the risks of future AI justify shutting down open source initiatives, but if people suggesting this do not also recognize the huge risks that come from closing off the economy of AI, then I find them hard to trust.

  //   Personally, I believe the risks are huge on every side. The current harms of AI, the risks of a near-future superintelligent AI, the risks of power concentration if we close off the economy of AI…
  //   …and I'll add one: the risk of AI fear-mongering being instrumentalized by a power-seeking individual or group.

  //   I don't know how to balance our decisions in such a complicated landscape. However, I know I have a hard time trusting anyone who doesn't clearly acknowledge we're facing a complex problem; or who insists on shining the spotlight on a single risk, or — worse — on a single solution.

  //   ""Years of sociotechnical research show that advanced digital technologies, left unchecked, are used to pursue power and profit at the expense of human rights, social justice, and democracy.`,
  //   external: {
  //     uri: 'https://www.science.org/doi/10.1126/science.adi8982',
  //     title: 'AI safety on whose terms?',
  //     description: `Rapid, widespread adoption of the latest large language models has sparked both excitement and concern about advanced artificial intelligence (AI). In response, many are looking to the field of AI safety for answers. Major AI companies are purportedly ...`,
  //     thumb: ogAiSafetyB64,
  //   },
  //   replies: [],
  // },
]
