import embedB64 from './img/embed-b64'
import embedVerticalB64 from './img/embed-vertical-b64'
import embedHorizontalB64 from './img/embed-horizontal-b64'
import ogYouTubeB64 from './img/og-you-tube-b64'
import ogImageB64 from './img/og-image-b64'

interface LongPost {
  text: string
  image?: string
  external?: { uri: string; title: string; description: string; thumb?: string }
}

const external = {
  uri: 'https://www.newyorker.com/magazine/2011/05/16/creation-myth',
  title: 'Creation Myth',
  description: 'Xerox PARC, Apple, and the truth about innovation.',
}

const externalThumb = { ...external, thumb: ogImageB64 }

const externalYouTube = {
  uri: 'https://www.youtube.com/watch?v=Oj_Fa6gSf_E',
  title: 'A.L.I.S.O.N & VIQ - Ardent [Track]',
  description: 'https://alisonsynths.bandcamp.com/music"',
  thumb: ogYouTubeB64,
}

const longPosts: LongPost[] = [
  // No text, image
  {
    text: '',
    image: embedB64,
  },
  // Short text, no image
  {
    text: 'I think therefore we all are',
  },
  // Short text, image
  {
    text: 'The beauty of album covers',
    image: embedB64,
  },
  // Long text, no image
  {
    text: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla vitae arcu ut nulla dictum sagittis. Integer viverra ullamcorper augue vitae gravida. Cras quis mauris ac eros iaculis aliquam. Aliquam sit amet quam vitae turpis vehicula pellentesque sed feugiat turpis. Nam interdum laoreet pulvinar. Nulla eu blandit lectus. Sed quis tortor eget metus vulputate blandit sit amet nec erat. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse potenti.
Praesent sed dui ac tellus congue aliquam vitae eu quam. Nullam vitae ante quis sem semper semper non ac diam. Ut porta justo quis interdum placerat. Aliquam efficitur bibendum leo non condimentum. Fusce ullamcorper ultricies nunc ut ornare. Duis interdum vehicula risus, sit amet porta nunc facilisis ac. Nulla facilisi. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Maecenas molestie justo sed arcu facilisis, et accumsan neque placerat. Ut fringilla vehicula magna, ac pellentesque neque pretium vel.
Nulla facilisi. Aenean auctor dignissim neque, dapibus vulputate dui semper euismod. Integer ut turpis at urna congue suscipit. Nulla facilisi. Ut sit amet malesuada orci. Aliquam id tellus vel diam luctus pulvinar vel eget felis. Aliquam erat volutpat. Phasellus semper nibh mi, quis laoreet est blandit sit amet. Nulla facilisi. Vivamus semper sem et ligula tincidunt, nec lacinia ex maximus.
Nunc fringilla gravida diam, ac sollicitudin lacus pharetra id. Fusce imperdiet turpis mauris, eu laoreet enim vulputate luctus. Nulla eu pharetra risus, a dapibus libero. Vestibulum auctor turpis sem, a accumsan metus venenatis at. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Vivamus lorem erat, aliquam ac placerat eget, dapibus id urna. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Donec hendrerit magna vel lacus varius, a consequat neque tempor. Vestibulum rutrum elit nec enim pretium, sed viverra felis molestie. Nunc a urna in nibh molestie tempor nec eget ex. Curabitur condimentum erat libero, quis porta odio malesuada vitae. Integer vulputate purus sed quam convallis, in egestas quam ultricies. Integer interdum posuere elit a tempus. Proin interdum porta viverra. Maecenas condimentum fermentum euismod. Curabitur arcu purus, pellentesque tempor tellus at, dictum faucibus felis.
Nunc ultricies fermentum faucibus. Nunc ac urna congue mi tristique pharetra at eu eros. Donec ipsum velit, lobortis vel nisl ac, laoreet iaculis tellus. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus molestie ipsum tincidunt pulvinar interdum. Aliquam erat volutpat. Cras tempus leo risus, tempus lobortis ex pellentesque et. Etiam convallis lorem elit, eget aliquam dui rhoncus sit amet. In quis euismod elit. Sed ut elit a diam elementum varius semper imperdiet quam. Donec ut hendrerit magna. Mauris ac feugiat urna, ac fermentum felis. Donec nec blandit augue. Pellentesque hendrerit, lorem eget accumsan aliquam, velit turpis laoreet dolor, sit amet cursus enim purus sit amet lectus. Mauris nec tortor turpis.`,
  },
  // Long text, image
  {
    text: `Harvard University, a name that conjures images of academic brilliance, revered halls of learning, and an air of intellectual exclusivity. However, nestled within the hallowed grounds of this venerable institution lies a hidden chamber that, in contrast to the serene facade of academia, pulsates with raw energy, sweat, and unyielding determination—the Harvard Crimson's basketball locker room.
Walking down the dimly lit, nondescript corridor, one could easily pass by the unremarkable door without giving it a second thought. Little do they know that behind those unassuming walls lies a realm of fervent camaraderie and unspoken bonds that form the heart and soul of the Harvard basketball program.
As one pushes open the door, the clatter of metal and laughter fills the air. Inside, the scene is reminiscent of a lively marketplace where athletes of diverse backgrounds and personalities converge. The scent of freshly laundered jerseys mingles with the aroma of sports drinks and sweat, creating a unique and unmistakable blend that defines the space.
The room itself, though not grandiose in size, is adorned with the hallmarks of Harvard's illustrious past. Photographs of legendary players and championship-winning teams line the walls, serving as a testament to the storied legacy that the players aspire to uphold with every dribble and shot.
But beyond the mementos of the past, it's the present that animates this sacred space. Players bustle around, each engaged in their unique pre-game rituals. One may find a player intensely focused, headphones on, eyes closed, visualizing the forthcoming game and mentally rehearsing every move. Another may be surrounded by teammates, sharing jokes and laughter, seeking to ease the tension that inevitably comes before each clash on the court.'
Here, the rigors of academia, the weight of expectations, and the scrutiny of Ivy League excellence are temporarily set aside. The hardwood calls, and the pursuit of athletic glory consumes the minds of these students-turned-athletes. It is a delicate balance, an intricate dance between the scholar and the sportsman, and the locker room is where these worlds intersect and harmonize.
For a team to thrive, camaraderie is essential. The locker room, a sanctum of trust and unity, is where bonds are forged, and individual talents coalesce into a collective force. Here, hierarchies based on class years or accolades dissolve. Seniors mentor rookies, veterans inspire novices, and the spirit of collaboration fosters an atmosphere of growth and collective betterment.`,
    image: embedB64,
  },
  // Short text, link, no thumbnail
  {
    text: 'We love to think people create alone.',
    external,
  },
  // Long text, link, no thumbnail
  {
    text: `I came across an incredible article that I know you'll absolutely love, especially if you're a Steve Jobs enthusiast. It's all about an iconic visit he made to Xerox PARC back in late 1979—a turning point in the history of computing and innovation.
The article takes us on a journey to Xerox PARC, the innovation hub of the Xerox Corporation, where Jobs had the opportunity to witness some groundbreaking technology. You'll get to read about how he proposed a deal to Xerox, offering them a stake in Apple in exchange for a peek at their cutting-edge developments. The negotiations, the curiosity, and the eventual tour of Xerox PARC make for a thrilling read.
You'll be delighted to know that it was this very visit that inspired Jobs to push his team at Apple to think bigger and bolder. The result? The creation of the legendary Macintosh, a product that left an indelible mark on the tech world.
But it doesn't stop there! The article also sheds light on the untold story of the Apple mouse's development. After the PARC visit, Jobs met with the talented minds at IDEO, a prominent industrial-design firm. The challenge he presented to them led to the birth of a mouse that would change the way we interact with computers forever.
I can't emphasize enough how captivating this piece is and how much it deepened my admiration for Steve Jobs' vision and determination. If you're as passionate about him as I am, you won't want to miss this read!`,
    external,
  },
  // No text, link, thumbnail
  {
    text: '',
    external: externalThumb,
  },
  // Short text, link, thumbnail
  {
    text: 'Good artists copy, Great artists steal.',
    external: externalThumb,
  },
  // Long text, link, thumbnail
  {
    text: `Greetings, dear readers! Today, we embark on a journey through the corridors of technological history—a journey that inspired some of the most revolutionary design innovations in the tech world. Join us as we explore the legendary encounter between Steve Jobs and Xerox PARC, a pivotal moment that fueled the birth of an iconic design.
The Meeting of Minds:
In the late 1970s, the visionary entrepreneur, Steve Jobs, paid a visit to the renowned Silicon Valley research center, Xerox PARC. The innovative hub was filled with brilliant minds, and Jobs seized the opportunity to strike a groundbreaking deal. He offered Xerox a stake in his up-and-coming company, Apple, in exchange for a glimpse into their cutting-edge technology—a move that would alter the course of computing history forever.
The PARC Revelation:
At Xerox PARC, Jobs was introduced to the Xerox Alto—a personal computer unlike any other at the time. Its graphical user interface, mouse, and windows showcased a glimpse into the future of computing. Jobs was enthralled by the possibilities and realized the untapped potential of this groundbreaking technology.
Inspiration Transformed:
Returning to Apple with newfound inspiration, Steve Jobs challenged his team to think differently and boldly. The result was the creation of the iconic Macintosh—the epitome of user-friendly design and innovation. The Macintosh redefined personal computing, setting new standards for interaction and usability.
The Birth of the Apple Mouse:
Jobs' encounter with Xerox PARC didn't just inspire software innovations but also marked the genesis of a humble yet crucial design element—the Apple mouse. Collaborating with the brilliant minds at IDEO, a renowned industrial-design firm, Jobs sought to create an affordable, durable, and user-friendly mouse. The result was a device that transformed the way we interacted with computers and remains an integral part of modern-day computing.
Legacy and Impact:
The legend of Xerox PARC and Steve Jobs lives on as a testament to the power of visionary design. Jobs' pursuit of excellence, fueled by the innovation at PARC, led to the birth of a design empire that continues to shape the tech landscape today.
Conclusion:
As a design company, we draw inspiration from the iconic encounters that have shaped the tech world. The meeting of Steve Jobs and Xerox PARC exemplifies the spirit of innovation and boldness that we strive to embody in our work. Together, let's celebrate the indelible impact of design pioneers and their lasting influence on our daily lives.    
Thank you for joining us on this insightful journey! Until next time, keep dreaming, designing, and changing the world!`,
    external: externalThumb,
  },
  // Youtube, no text
  {
    text: '',
    external: externalYouTube,
  },
  // Youtube, short text
  {
    text: 'My favorite track these days',
    external: externalYouTube,
  },
  // Youtube, long text
  {
    text: `I just stumbled upon an incredibly talented artist, A.L.I.S.O.N, and I couldn't wait to share their music with all of you! 🎶🎧 Hailing from Bordeaux, France, A.L.I.S.O.N is a master of the synth/chillwave genre, and their tracks have a mesmerizing quality that you won't be able to resist.
I just listened to one of their popular songs, and I must say, it's an absolute gem! The smooth, dreamy vibes combined with the captivating synth melodies create a beautiful, immersive experience. 💫✨ If you're into soothing beats that transport you to another world, this is exactly what you need to check out.
Don't just take my word for it—give it a listen yourself! Here's the link to the track I'm talking about: [insert link to the track]. Prepare to be enchanted by A.L.I.S.O.N's musical magic. 🎵💙 Let's support this incredible artist and spread the good vibes around! 🌈✨ #ALISON #Synthwave #Chillwave #MusicDiscovery`,
    external: externalYouTube,
  },
  // No text, image vertical
  {
    text: '',
    image: embedVerticalB64,
  },
  // Short text, image vertical
  {
    text: 'Took this with my old iphone',
    image: embedVerticalB64,
  },
  // Long text, image vertical
  {
    text: `🇪🇺 GDPR vs. 🇺🇸 Privacy Law: A Tale of Two Approaches to Protecting Personal Data 🤝📜
Hey everyone! 🌟 As a data privacy enthusiast, I couldn't help but draw comparisons between the General Data Protection Regulation (GDPR) in the European Union and the privacy laws in the United States. 🤔💭 Let's take a quick peek at how these two systems differ in safeguarding our precious personal data! 🛡️💻
🌍 Scope and Territorial Application:
GDPR casts a broad net, applying to all EU member states and any organization outside the EU processing data of EU residents. 🌐 On the other hand, privacy laws in the US often vary by state, creating a patchwork of regulations without a unified nationwide standard.
📃 Consent and Individual Rights:
Under GDPR, consent is king! 👑 Companies must obtain clear and explicit consent from individuals before collecting and processing their data. 📝🔍 Individuals also enjoy a host of rights, including the right to access, rectify, and even erase their personal information. 😌 In the US, consent requirements and individual rights vary depending on the state and industry, leading to varying levels of protection.
⚖️ Enforcement and Fines:
When it comes to enforcing privacy regulations, GDPR wields a mighty hammer! 🔨 Non-compliance can result in substantial fines, reaching up to 4% of a company's global annual turnover. 💰 In contrast, US privacy law enforcement can be more fragmented, with different agencies handling different aspects, and fines may not always be as severe.
🔍 Data Minimization and Purpose Limitation:
The GDPR emphasizes data minimization and purpose limitation, encouraging organizations to collect only what's necessary and for specific, legitimate reasons. 🎯 In the US, while there are similar principles, they might not be as rigorously enforced or standardized.
🛡️ Data Protection Officer:
Under GDPR, certain organizations must appoint a Data Protection Officer (DPO) to oversee data protection matters. 👤 In the US, while privacy officers exist, they might not carry the same statutory mandate as a DPO in the EU.
🌱 Cultural Perspectives:
Perhaps one of the most significant differences lies in the cultural approach to privacy. 🌿 In the EU, privacy is considered a fundamental right, and data protection is deeply ingrained in their legal framework. 🏛️ In the US, the concept of privacy is often seen as a balancing act between protecting individuals' rights and enabling businesses to thrive.
💼 Implications for Businesses:
Navigating GDPR can be a bit like traversing a labyrinth 🧩, while US privacy laws may feel more like a maze with different twists and turns depending on the state. 🤯 For businesses operating internationally, compliance with GDPR can be particularly challenging, but it has also set a precedent for global data protection standards.
🤝 Conclusion:
In the end, both GDPR and US privacy laws share a common goal: to safeguard our personal data in this digital age. 🛡️📲 While their approaches differ, the underlying mission of protecting individual privacy remains paramount. Let's continue advocating for responsible data practices and greater transparency across the board! 🌐🔍

#GDPR #PrivacyLaw #DataProtection #PersonalData #DataPrivacy #EUvsUS #DigitalAge #ProtectingPrivacy`,
    image: embedVerticalB64,
  },
  // No text, image horizontal
  {
    text: '',
    image: embedHorizontalB64,
  },
  // Short text, image horizontal
  {
    text: `I'll go there someday...`,
    image: embedHorizontalB64,
  },
  // Long text, image horizontal
  {
    text: `I had always been drawn to the allure of exploration—the idea of embarking on a solitary journey to unearth the raw beauty of the world. Crete, with its mythical tales and untamed landscapes, beckoned me with an irresistible call. And so, armed with a backpack and an unquenchable thirst for adventure, I set out on a solo hiking expedition that would forever change my perspective on travel.
My week-long journey began at the northern shores of Crete. The White Mountains loomed majestically before me as I took my first steps on this mythical island. With each stride, the world around me seemed to transform—a symphony of untamed gorges, ancient ruins, and vibrant flora greeted me along the way.
The Samaria Gorge stood as a testament to nature's grandeur, and I couldn't help but feel humbled by its vastness. Hiking through its awe-inspiring beauty, I felt a deep connection with the spirits of this land, and a sense of tranquility enveloped me like a comforting embrace.
Venturing through the ethereal forest of Rouvas, I sensed the whispers of ancient trees, their roots firmly grounded in the soil of centuries past. It was a humbling experience—one that taught me to appreciate the harmony between man and nature, and the eternal cycle of life.
Each night, I pitched my tent beneath a celestial canopy of stars. The nocturnal orchestra of crickets and gentle sea breezes lulled me to sleep, and I woke up each morning with renewed vigor for the day's journey ahead.
As I approached Crete's southern coast, the landscape underwent a dramatic metamorphosis. Rugged cliffs gave way to sweeping views of the cerulean Libyan Sea. Here, I stumbled upon a hidden gem—a small fishing village that seemed untouched by time.
Aghia Pelagia, as the locals affectionately called it, welcomed me with open arms. Its cobblestone streets and quaint houses exuded an authentic charm, contrasting with the bustling tourist destinations. Here, time seemed to slow down, allowing me to immerse myself in the village's timeless rhythm.
I decided to take a break from my hiking expedition and extend my stay in Aghia Pelagia. It was a decision I would never regret. The village's warmth and hospitality made me feel like a part of their close-knit community—a home away from home.
In the company of newfound friends, I explored the surrounding landscapes—hidden coves that sheltered me from the world's cares, and ancient trails where legends seemed to come alive. The locals shared with me their stories, their traditions, and the secrets of this haven they called home.
Evenings in Aghia Pelagia were magical. I joined the villagers in traditional dances under the starry sky, a mesmerizing celebration of life's simple joys. The tantalizing aroma of freshly prepared seafood beckoned, and I savored the taste of Greece's culinary delights.
My days turned into weeks as I embraced the slow-paced serenity of Aghia Pelagia. I reveled in the beauty of human connections, an experience that transcended the boundaries of language and culture. Here, I discovered the true essence of travel—the pursuit of connections that enrich the soul.
As the time came to bid farewell to Aghia Pelagia, my heart was filled with gratitude. I had stumbled upon a place that felt like a sanctuary—a testament to the enduring spirit of exploration and the treasures found in unassuming fishing villages.
Crete had captivated me with its untamed beauty, but it was in Aghia Pelagia that I found solace. The memories of this extraordinary journey will forever be etched in my heart—the stories shared, the laughter echoing in the air, and the boundless beauty of Crete's south coast.
In the vast tapestry of the world, it is often the smallest, most intimate experiences that leave the deepest impact. Aghia Pelagia had become more than just a destination—it had become a part of my soul, a reminder of the connections that make travel a journey of the heart.
As I walked away, I knew that Aghia Pelagia would forever hold a cherished place in my memories. It was a testament to the allure of wanderlust—the pursuit of unknown horizons and the hidden charms that await those who dare to explore.`,
    image: embedHorizontalB64,
  },
]

export default longPosts
