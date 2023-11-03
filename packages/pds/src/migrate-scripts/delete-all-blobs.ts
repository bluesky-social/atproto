import dotenv from 'dotenv'
import { envToCfg, envToSecrets, readEnv } from '../config'
import AppContext from '../context'
import { CID } from 'multiformats/cid'

dotenv.config()

const cids = [
  'bafkreiacrjijybmsgnq3mca6fvhtvtc7jdtjflomoenrh4ph77kghzkiii',
  'bafkreialwja7cnlm277rvhhd5xbsx5pmle3qkdlawgjwlo6ixxote6ttma',
  'bafkreiaufsjrngaj72hfaz5ygjh7rbojjermjzr6w2dzuqdx77aitvg44u',
  'bafkreibifbolkvpvmxxxcl5tmutdpsdc7zsqxwnlbjqpx7k3egfjmofrwe',
  'bafkreibsqtzi5i6i2kzb6twtegcmf47lnp4xajdsqidczyhgmwbhtxuyvu',
  'bafkreic56lmscb5cfgyprq3s5kly3wqh6jbg2bmy4psaqzd5vaifoygfqe',
  'bafkreicsakzgsf34qg26brx7m7wiyu7t6tc62ffyuh7fiuny4i56vg3uim',
  'bafkreictwlsdrcidkj3ad27b5f6y3tqw6uvtjdzmfjmsk4fso3dfgjfd4e',
  'bafkreicucm3uiukcjbtcxsmi3ezbvdppx7ug33rec7jxvdli3vz5rc7tle',
  'bafkreicwuejxgfzb7ckawvjta237524mphfb6m7idxqnv6qs5npw7yzkpq',
  'bafkreid6rkqx7emoxh5kvfufzhukovvmqppag3ofzco73acl5bzotnni5a',
  'bafkreidn4wxas2kfh3bztk5kb5nmwwbv4pqyadbrgkeuc6wy67pugybafu',
  'bafkreie6ibwqj2hzt6xrwhoenxphoizxwq3cidja3vme5dhehu65qfuxge',
  'bafkreie7t4a4etsl6d3xa6pcfbjgumajcadguypx72hmzlipets2ryfosu',
  'bafkreiejrttiky2oc6kempihywklpodvk245ii4r222w75lfsmwsc5mvxu',
  'bafkreieqq463374bbcbeq7gpmet5rvrpeqow6t4rtjzrkhnlumdylagaqa',
  'bafkreig7giif65hcs667s2afjdhc4so4koh733jlc5ol4l7jz4nxovtg6u',
  'bafkreigiajg3yqlsy3ai3awepbfbfm2pkcn2koidersjxfw2hnywww2gp4',
  'bafkreigk26dzfyeyvpjadajzhdorm4hkj2vaypwtwwgxlt74dscitomfse',
  'bafkreigqua3j6sg5duq5nukwapy4aon6ong7h6pexh6pgiugjepkivyfvu',
  'bafkreigzvsibgf573tsicbsln5inivcncwyb3hf6ezxcbpxpsgmcsmwj4y',
  'bafkreihjy3455h6z7emr6nn45ae4lzuzxzqvrin2jxqgkf3wekthrrvzc4',
  'bafkreihpegorhwl4yr46nmwiwweyejbm6p2rycrymkgpkhvhin73zpk5ra',
]

const run = async () => {
  const env = readEnv()
  const cfg = envToCfg(env)
  const secrets = envToSecrets(env)
  const ctx = await AppContext.fromConfig(cfg, secrets)
  const blobstore = ctx.blobstore('did:plc:wqzurwm3kmaig6e6hnc2gqwo')
  const toDelete = cids.map((c) => CID.parse(c))
  await blobstore.deleteMany(toDelete)
}

run()
