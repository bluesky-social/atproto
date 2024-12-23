import { Selectable, sql } from 'kysely'
import { AtUri, normalizeDatetimeAlways } from '@atproto/syntax'
import { CID } from 'multiformats/cid'
import * as lex from '../../../../lexicon/lexicons'
import * as PollAnswer from '../../../../lexicon/types/app/bsky/feed/pollAnswer'
import RecordProcessor from '../processor'
import { Database } from '../../db'
import { DatabaseSchema, DatabaseSchemaType } from '../../db/database-schema'
import { BackgroundQueue } from '../../background'
import { bitMask, countAll, excluded } from '../../db/util'

const lexId = lex.ids.AppBskyFeedPollAnswer
type IndexedPollAnswer = Selectable<DatabaseSchemaType['poll_answer']>

const insertFn = async (
    db: DatabaseSchema,
    uri: AtUri,
    cid: CID,
    obj: PollAnswer.Record,
    timestamp: string,
): Promise<IndexedPollAnswer | null> => {
    const inserted = await db
        .insertInto('poll_answer')
        .values({
            uri: uri.toString(),
            cid: cid.toString(),
            creator: uri.host,
            subject: obj.subject.uri,
            subjectCid: obj.subject.cid,
            answer: obj.answer,
            createdAt: normalizeDatetimeAlways(obj.createdAt),
            indexedAt: timestamp,
        })
        .onConflict((oc) => oc.doNothing())
        .returningAll()
        .executeTakeFirst()
    return inserted || null
}

const findDuplicate = async (
    db: DatabaseSchema,
    uri: AtUri,
    obj: PollAnswer.Record,
): Promise<AtUri | null> => {
    const found = await db
        .selectFrom('poll_answer')
        .where('creator', '=', uri.host)
        .where('subject', '=', obj.subject.uri)
        .selectAll()
        .executeTakeFirst()
    return found ? new AtUri(found.uri) : null
}

const notifsForInsert = (obj: IndexedPollAnswer) => {
    const subjectUri = new AtUri(obj.subject)
    if (subjectUri.host === obj.creator) {
        return [];
    }

    return [
        {
            did: subjectUri.host,
            author: obj.creator,
            recordUri: obj.uri,
            recordCid: obj.cid,
            reason: 'pollAnswer' as const,
            reasonSubject: subjectUri.toString(),
            sortAt: obj.sortAt,
        }
    ]
}

const deleteFn = async (
    db: DatabaseSchema,
    uri: AtUri,
): Promise<IndexedPollAnswer | null> => {
    const deleted = await db
        .deleteFrom('poll_answer')
        .where('uri', '=', uri.toString())
        .returningAll()
        .executeTakeFirst()
    return deleted || null
}

const notifsForDelete = (
    deleted: IndexedPollAnswer,
    replacedBy: IndexedPollAnswer | null,
) => {
    const toDelete = replacedBy ? [] : [deleted.uri]
    return { notifs: [], toDelete }
}

const updateAggregates = async (db: DatabaseSchema, pollAnswer: IndexedPollAnswer) => {
    const numOptions = 4; // TODO: Is there a better way to fetch this constraint? Can we get it directly from the lexicon?
    const mask = Array.from({ length: numOptions }, (_, i) => 1 << i);
    const pollAnswersArrayQuery = db
        .with(
            'poll_answers_bitmask',
            (q) => {
                const select = q
                    .selectFrom('poll_answer')
                    .where('subject', '=', pollAnswer.subject);

                mask.forEach(
                    (mask, i) => {
                        select.select(bitMask(db, 'answer', mask).as(String.fromCharCode(65 + i)))
                    }
                )

                return select;
            }
        )
        .selectFrom('poll_answers_bitmask')
        .select(sql<number[]>`JSON_ARRAY(${mask.map((_, i) => `SUM(${String.fromCharCode(65 + i)})`).join(', ')})`.as('answers'));
    const pollAnswersValue = await pollAnswersArrayQuery.execute();

    const empty = Array.from({ length: numOptions }, () => 0);
    const pollAnswerCountQb = db
        .insertInto('post_agg')
        .values({
            uri: pollAnswer.subject,
            pollAnswerCount: db
                .selectFrom('poll_answer')
                .where('subject', '=', pollAnswer.subject)
                .select(countAll.as('count')),
            pollAnswers: pollAnswersValue.at(0)?.answers ?? empty,
        })
        .onConflict((oc) =>
            oc.column('uri').doUpdateSet({
                pollAnswerCount: excluded(db, 'pollAnswerCount'),
                pollAnswers: excluded(db, 'pollAnswers'),
            })
        )
    await pollAnswerCountQb.execute()
}

export type PluginType = RecordProcessor<PollAnswer.Record, IndexedPollAnswer>

export const makePlugin = (
    db: Database,
    background: BackgroundQueue,
): PluginType => {
    return new RecordProcessor(db, background, {
        lexId,
        insertFn,
        findDuplicate,
        deleteFn,
        notifsForInsert,
        notifsForDelete,
        updateAggregates,
    })
}

export default makePlugin