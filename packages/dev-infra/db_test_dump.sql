--
-- PostgreSQL database dump
--

-- Dumped from database version 14.4
-- Dumped by pg_dump version 14.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: bsky; Type: SCHEMA; Schema: -; Owner: pg
--

CREATE SCHEMA bsky;


ALTER SCHEMA bsky OWNER TO pg;

--
-- Name: ozone_db; Type: SCHEMA; Schema: -; Owner: pg
--

CREATE SCHEMA ozone_db;


ALTER SCHEMA ozone_db OWNER TO pg;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: actor; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.actor (
    did character varying NOT NULL,
    handle character varying,
    "indexedAt" character varying NOT NULL,
    "takedownRef" character varying,
    "upstreamStatus" character varying
);


ALTER TABLE bsky.actor OWNER TO pg;

--
-- Name: actor_block; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.actor_block (
    uri character varying NOT NULL,
    cid character varying NOT NULL,
    creator character varying NOT NULL,
    "subjectDid" character varying NOT NULL,
    "createdAt" character varying NOT NULL,
    "indexedAt" character varying NOT NULL,
    "sortAt" character varying GENERATED ALWAYS AS (LEAST("createdAt", "indexedAt")) STORED NOT NULL
);


ALTER TABLE bsky.actor_block OWNER TO pg;

--
-- Name: actor_state; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.actor_state (
    did character varying NOT NULL,
    "lastSeenNotifs" character varying NOT NULL
);


ALTER TABLE bsky.actor_state OWNER TO pg;

--
-- Name: actor_sync; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.actor_sync (
    did character varying NOT NULL,
    "commitCid" character varying NOT NULL,
    "commitDataCid" character varying NOT NULL,
    "rebaseCount" integer NOT NULL,
    "tooBigCount" integer NOT NULL,
    "repoRev" character varying
);


ALTER TABLE bsky.actor_sync OWNER TO pg;

--
-- Name: post; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.post (
    uri character varying NOT NULL,
    cid character varying NOT NULL,
    creator character varying NOT NULL,
    text character varying NOT NULL,
    "replyRoot" character varying,
    "replyRootCid" character varying,
    "replyParent" character varying,
    "replyParentCid" character varying,
    "createdAt" character varying NOT NULL,
    "indexedAt" character varying NOT NULL,
    "sortAt" character varying GENERATED ALWAYS AS (LEAST("createdAt", "indexedAt")) STORED NOT NULL,
    langs jsonb,
    "invalidReplyRoot" boolean,
    "violatesThreadGate" boolean,
    tags jsonb
);


ALTER TABLE bsky.post OWNER TO pg;

--
-- Name: post_agg; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.post_agg (
    uri character varying NOT NULL,
    "likeCount" bigint DEFAULT 0 NOT NULL,
    "replyCount" bigint DEFAULT 0 NOT NULL,
    "repostCount" bigint DEFAULT 0 NOT NULL
);


ALTER TABLE bsky.post_agg OWNER TO pg;

--
-- Name: view_param; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.view_param (
    name character varying NOT NULL,
    value character varying
);


ALTER TABLE bsky.view_param OWNER TO pg;

--
-- Name: algo_whats_hot_view; Type: MATERIALIZED VIEW; Schema: bsky; Owner: pg
--

CREATE MATERIALIZED VIEW bsky.algo_whats_hot_view AS
 SELECT post.uri,
    post.cid,
    round(((1000000)::numeric * ((post_agg."likeCount")::numeric / (((EXTRACT(epoch FROM age(now(), ((post."indexedAt")::timestamp without time zone)::timestamp with time zone)) / (3600)::numeric) + (2)::numeric) ^ 1.8)))) AS score
   FROM (bsky.post
     JOIN bsky.post_agg ON (((post_agg.uri)::text = (post.uri)::text)))
  WHERE (((post."indexedAt")::text > ( SELECT to_char((now() - (view_param.value)::interval), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'::text) AS val
           FROM bsky.view_param
          WHERE ((view_param.name)::text = 'whats_hot_interval'::text))) AND (post."replyParent" IS NULL) AND (post_agg."likeCount" > ( SELECT (view_param.value)::integer AS val
           FROM bsky.view_param
          WHERE ((view_param.name)::text = 'whats_hot_like_threshold'::text))))
  WITH NO DATA;


ALTER TABLE bsky.algo_whats_hot_view OWNER TO pg;

--
-- Name: blob_takedown; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.blob_takedown (
    did character varying NOT NULL,
    cid character varying NOT NULL,
    "takedownRef" character varying NOT NULL
);


ALTER TABLE bsky.blob_takedown OWNER TO pg;

--
-- Name: did_cache; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.did_cache (
    did character varying NOT NULL,
    doc jsonb NOT NULL,
    "updatedAt" bigint NOT NULL
);


ALTER TABLE bsky.did_cache OWNER TO pg;

--
-- Name: duplicate_record; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.duplicate_record (
    uri character varying NOT NULL,
    cid character varying NOT NULL,
    "duplicateOf" character varying NOT NULL,
    "indexedAt" character varying NOT NULL
);


ALTER TABLE bsky.duplicate_record OWNER TO pg;

--
-- Name: feed_generator; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.feed_generator (
    uri character varying NOT NULL,
    cid character varying NOT NULL,
    creator character varying NOT NULL,
    "feedDid" character varying NOT NULL,
    "displayName" character varying,
    description character varying,
    "descriptionFacets" character varying,
    "avatarCid" character varying,
    "createdAt" character varying NOT NULL,
    "indexedAt" character varying NOT NULL,
    "sortAt" character varying GENERATED ALWAYS AS (LEAST("createdAt", "indexedAt")) STORED NOT NULL
);


ALTER TABLE bsky.feed_generator OWNER TO pg;

--
-- Name: feed_item; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.feed_item (
    uri character varying NOT NULL,
    cid character varying NOT NULL,
    type character varying NOT NULL,
    "postUri" character varying NOT NULL,
    "originatorDid" character varying NOT NULL,
    "sortAt" character varying NOT NULL
);


ALTER TABLE bsky.feed_item OWNER TO pg;

--
-- Name: follow; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.follow (
    uri character varying NOT NULL,
    cid character varying NOT NULL,
    creator character varying NOT NULL,
    "subjectDid" character varying NOT NULL,
    "createdAt" character varying NOT NULL,
    "indexedAt" character varying NOT NULL,
    "sortAt" character varying GENERATED ALWAYS AS (LEAST("createdAt", "indexedAt")) STORED NOT NULL
);


ALTER TABLE bsky.follow OWNER TO pg;

--
-- Name: kysely_migration; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.kysely_migration (
    name character varying(255) NOT NULL,
    "timestamp" character varying(255) NOT NULL
);


ALTER TABLE bsky.kysely_migration OWNER TO pg;

--
-- Name: kysely_migration_lock; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.kysely_migration_lock (
    id character varying(255) NOT NULL,
    is_locked integer DEFAULT 0 NOT NULL
);


ALTER TABLE bsky.kysely_migration_lock OWNER TO pg;

--
-- Name: label; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.label (
    src character varying NOT NULL,
    uri character varying NOT NULL,
    cid character varying NOT NULL,
    val character varying NOT NULL,
    neg boolean NOT NULL,
    cts character varying NOT NULL
);


ALTER TABLE bsky.label OWNER TO pg;

--
-- Name: labeler; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.labeler (
    uri character varying NOT NULL,
    cid character varying NOT NULL,
    creator character varying NOT NULL,
    "createdAt" character varying NOT NULL,
    "indexedAt" character varying NOT NULL,
    "sortAt" character varying GENERATED ALWAYS AS (LEAST("createdAt", "indexedAt")) STORED NOT NULL
);


ALTER TABLE bsky.labeler OWNER TO pg;

--
-- Name: like; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky."like" (
    uri character varying NOT NULL,
    cid character varying NOT NULL,
    creator character varying NOT NULL,
    subject character varying NOT NULL,
    "subjectCid" character varying NOT NULL,
    "createdAt" character varying NOT NULL,
    "indexedAt" character varying NOT NULL,
    "sortAt" character varying GENERATED ALWAYS AS (LEAST("createdAt", "indexedAt")) STORED NOT NULL
);


ALTER TABLE bsky."like" OWNER TO pg;

--
-- Name: list; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.list (
    uri character varying NOT NULL,
    cid character varying NOT NULL,
    creator character varying NOT NULL,
    name character varying NOT NULL,
    purpose character varying NOT NULL,
    description character varying,
    "descriptionFacets" character varying,
    "avatarCid" character varying,
    "createdAt" character varying NOT NULL,
    "indexedAt" character varying NOT NULL,
    "sortAt" character varying GENERATED ALWAYS AS (LEAST("createdAt", "indexedAt")) STORED NOT NULL
);


ALTER TABLE bsky.list OWNER TO pg;

--
-- Name: list_block; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.list_block (
    uri character varying NOT NULL,
    cid character varying NOT NULL,
    creator character varying NOT NULL,
    "subjectUri" character varying NOT NULL,
    "createdAt" character varying NOT NULL,
    "indexedAt" character varying NOT NULL,
    "sortAt" character varying GENERATED ALWAYS AS (LEAST("createdAt", "indexedAt")) STORED NOT NULL
);


ALTER TABLE bsky.list_block OWNER TO pg;

--
-- Name: list_item; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.list_item (
    uri character varying NOT NULL,
    cid character varying NOT NULL,
    creator character varying NOT NULL,
    "subjectDid" character varying NOT NULL,
    "listUri" character varying NOT NULL,
    "createdAt" character varying NOT NULL,
    "indexedAt" character varying NOT NULL,
    "sortAt" character varying GENERATED ALWAYS AS (LEAST("createdAt", "indexedAt")) STORED NOT NULL
);


ALTER TABLE bsky.list_item OWNER TO pg;

--
-- Name: list_mute; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.list_mute (
    "listUri" character varying NOT NULL,
    "mutedByDid" character varying NOT NULL,
    "createdAt" character varying NOT NULL
);


ALTER TABLE bsky.list_mute OWNER TO pg;

--
-- Name: moderation_action; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.moderation_action (
    id integer NOT NULL,
    action character varying NOT NULL,
    "subjectType" character varying NOT NULL,
    "subjectDid" character varying NOT NULL,
    "subjectUri" character varying,
    "subjectCid" character varying,
    reason text NOT NULL,
    "createdAt" character varying NOT NULL,
    "createdBy" character varying NOT NULL,
    "reversedAt" character varying,
    "reversedBy" character varying,
    "reversedReason" text,
    "createLabelVals" character varying,
    "negateLabelVals" character varying,
    "durationInHours" integer,
    "expiresAt" character varying
);


ALTER TABLE bsky.moderation_action OWNER TO pg;

--
-- Name: moderation_action_id_seq; Type: SEQUENCE; Schema: bsky; Owner: pg
--

CREATE SEQUENCE bsky.moderation_action_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE bsky.moderation_action_id_seq OWNER TO pg;

--
-- Name: moderation_action_id_seq; Type: SEQUENCE OWNED BY; Schema: bsky; Owner: pg
--

ALTER SEQUENCE bsky.moderation_action_id_seq OWNED BY bsky.moderation_action.id;


--
-- Name: moderation_action_subject_blob; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.moderation_action_subject_blob (
    "actionId" integer NOT NULL,
    cid character varying NOT NULL
);


ALTER TABLE bsky.moderation_action_subject_blob OWNER TO pg;

--
-- Name: moderation_event; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.moderation_event (
    id integer NOT NULL,
    action character varying NOT NULL,
    "subjectType" character varying NOT NULL,
    "subjectDid" character varying NOT NULL,
    "subjectUri" character varying,
    "subjectCid" character varying,
    comment text,
    meta jsonb,
    "createdAt" character varying NOT NULL,
    "createdBy" character varying NOT NULL,
    "reversedAt" character varying,
    "reversedBy" character varying,
    "durationInHours" integer,
    "expiresAt" character varying,
    "reversedReason" text,
    "createLabelVals" character varying,
    "negateLabelVals" character varying,
    "legacyRefId" integer
);


ALTER TABLE bsky.moderation_event OWNER TO pg;

--
-- Name: moderation_event_id_seq; Type: SEQUENCE; Schema: bsky; Owner: pg
--

CREATE SEQUENCE bsky.moderation_event_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE bsky.moderation_event_id_seq OWNER TO pg;

--
-- Name: moderation_event_id_seq; Type: SEQUENCE OWNED BY; Schema: bsky; Owner: pg
--

ALTER SEQUENCE bsky.moderation_event_id_seq OWNED BY bsky.moderation_event.id;


--
-- Name: moderation_report; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.moderation_report (
    id integer NOT NULL,
    "subjectType" character varying NOT NULL,
    "subjectDid" character varying NOT NULL,
    "subjectUri" character varying,
    "subjectCid" character varying,
    "reasonType" character varying NOT NULL,
    reason text,
    "reportedByDid" character varying NOT NULL,
    "createdAt" character varying NOT NULL
);


ALTER TABLE bsky.moderation_report OWNER TO pg;

--
-- Name: moderation_report_id_seq; Type: SEQUENCE; Schema: bsky; Owner: pg
--

CREATE SEQUENCE bsky.moderation_report_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE bsky.moderation_report_id_seq OWNER TO pg;

--
-- Name: moderation_report_id_seq; Type: SEQUENCE OWNED BY; Schema: bsky; Owner: pg
--

ALTER SEQUENCE bsky.moderation_report_id_seq OWNED BY bsky.moderation_report.id;


--
-- Name: moderation_report_resolution; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.moderation_report_resolution (
    "reportId" integer NOT NULL,
    "actionId" integer NOT NULL,
    "createdBy" character varying NOT NULL,
    "createdAt" character varying NOT NULL
);


ALTER TABLE bsky.moderation_report_resolution OWNER TO pg;

--
-- Name: moderation_subject_status; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.moderation_subject_status (
    id integer NOT NULL,
    did character varying NOT NULL,
    "recordPath" character varying DEFAULT ''::character varying NOT NULL,
    "blobCids" jsonb,
    "recordCid" character varying,
    "reviewState" character varying NOT NULL,
    comment character varying,
    "muteUntil" character varying,
    "lastReviewedAt" character varying,
    "lastReviewedBy" character varying,
    "lastReportedAt" character varying,
    takendown boolean DEFAULT false NOT NULL,
    "suspendUntil" character varying,
    "createdAt" character varying NOT NULL,
    "updatedAt" character varying NOT NULL
);


ALTER TABLE bsky.moderation_subject_status OWNER TO pg;

--
-- Name: moderation_subject_status_id_seq; Type: SEQUENCE; Schema: bsky; Owner: pg
--

CREATE SEQUENCE bsky.moderation_subject_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE bsky.moderation_subject_status_id_seq OWNER TO pg;

--
-- Name: moderation_subject_status_id_seq; Type: SEQUENCE OWNED BY; Schema: bsky; Owner: pg
--

ALTER SEQUENCE bsky.moderation_subject_status_id_seq OWNED BY bsky.moderation_subject_status.id;


--
-- Name: mute; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.mute (
    "subjectDid" character varying NOT NULL,
    "mutedByDid" character varying NOT NULL,
    "createdAt" character varying NOT NULL
);


ALTER TABLE bsky.mute OWNER TO pg;

--
-- Name: notification; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.notification (
    id bigint NOT NULL,
    did character varying NOT NULL,
    "recordUri" character varying NOT NULL,
    "recordCid" character varying NOT NULL,
    author character varying NOT NULL,
    reason character varying NOT NULL,
    "reasonSubject" character varying,
    "sortAt" character varying NOT NULL
);


ALTER TABLE bsky.notification OWNER TO pg;

--
-- Name: notification_id_seq; Type: SEQUENCE; Schema: bsky; Owner: pg
--

CREATE SEQUENCE bsky.notification_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE bsky.notification_id_seq OWNER TO pg;

--
-- Name: notification_id_seq; Type: SEQUENCE OWNED BY; Schema: bsky; Owner: pg
--

ALTER SEQUENCE bsky.notification_id_seq OWNED BY bsky.notification.id;


--
-- Name: notification_push_token; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.notification_push_token (
    did character varying NOT NULL,
    platform character varying NOT NULL,
    token character varying NOT NULL,
    "appId" character varying NOT NULL
);


ALTER TABLE bsky.notification_push_token OWNER TO pg;

--
-- Name: post_embed_external; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.post_embed_external (
    "postUri" character varying NOT NULL,
    uri character varying NOT NULL,
    title character varying NOT NULL,
    description character varying NOT NULL,
    "thumbCid" character varying
);


ALTER TABLE bsky.post_embed_external OWNER TO pg;

--
-- Name: post_embed_image; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.post_embed_image (
    "postUri" character varying NOT NULL,
    "position" character varying NOT NULL,
    "imageCid" character varying NOT NULL,
    alt character varying NOT NULL
);


ALTER TABLE bsky.post_embed_image OWNER TO pg;

--
-- Name: post_embed_record; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.post_embed_record (
    "postUri" character varying NOT NULL,
    "embedUri" character varying NOT NULL,
    "embedCid" character varying NOT NULL
);


ALTER TABLE bsky.post_embed_record OWNER TO pg;

--
-- Name: profile; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.profile (
    uri character varying NOT NULL,
    cid character varying NOT NULL,
    creator character varying NOT NULL,
    "displayName" character varying,
    description character varying,
    "avatarCid" character varying,
    "bannerCid" character varying,
    "indexedAt" character varying NOT NULL
);


ALTER TABLE bsky.profile OWNER TO pg;

--
-- Name: profile_agg; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.profile_agg (
    did character varying NOT NULL,
    "followersCount" bigint DEFAULT 0 NOT NULL,
    "followsCount" bigint DEFAULT 0 NOT NULL,
    "postsCount" bigint DEFAULT 0 NOT NULL
);


ALTER TABLE bsky.profile_agg OWNER TO pg;

--
-- Name: record; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.record (
    uri character varying NOT NULL,
    cid character varying NOT NULL,
    did character varying NOT NULL,
    json text NOT NULL,
    "indexedAt" character varying NOT NULL,
    "takedownRef" character varying
);


ALTER TABLE bsky.record OWNER TO pg;

--
-- Name: repost; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.repost (
    uri character varying NOT NULL,
    cid character varying NOT NULL,
    creator character varying NOT NULL,
    subject character varying NOT NULL,
    "subjectCid" character varying NOT NULL,
    "createdAt" character varying NOT NULL,
    "indexedAt" character varying NOT NULL,
    "sortAt" character varying GENERATED ALWAYS AS (LEAST("createdAt", "indexedAt")) STORED NOT NULL
);


ALTER TABLE bsky.repost OWNER TO pg;

--
-- Name: subscription; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.subscription (
    service character varying NOT NULL,
    method character varying NOT NULL,
    state character varying NOT NULL
);


ALTER TABLE bsky.subscription OWNER TO pg;

--
-- Name: suggested_feed; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.suggested_feed (
    uri character varying NOT NULL,
    "order" integer NOT NULL
);


ALTER TABLE bsky.suggested_feed OWNER TO pg;

--
-- Name: suggested_follow; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.suggested_follow (
    did character varying NOT NULL,
    "order" integer NOT NULL
);


ALTER TABLE bsky.suggested_follow OWNER TO pg;

--
-- Name: tagged_suggestion; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.tagged_suggestion (
    tag character varying NOT NULL,
    subject character varying NOT NULL,
    "subjectType" character varying NOT NULL
);


ALTER TABLE bsky.tagged_suggestion OWNER TO pg;

--
-- Name: thread_gate; Type: TABLE; Schema: bsky; Owner: pg
--

CREATE TABLE bsky.thread_gate (
    uri character varying NOT NULL,
    cid character varying NOT NULL,
    creator character varying NOT NULL,
    "postUri" character varying NOT NULL,
    "createdAt" character varying NOT NULL,
    "indexedAt" character varying NOT NULL
);


ALTER TABLE bsky.thread_gate OWNER TO pg;

--
-- Name: blob_push_event; Type: TABLE; Schema: ozone_db; Owner: pg
--

CREATE TABLE ozone_db.blob_push_event (
    id integer NOT NULL,
    "eventType" character varying NOT NULL,
    "subjectDid" character varying NOT NULL,
    "subjectBlobCid" character varying NOT NULL,
    "subjectUri" character varying,
    "takedownRef" character varying,
    "confirmedAt" timestamp with time zone,
    "lastAttempted" timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL
);


ALTER TABLE ozone_db.blob_push_event OWNER TO pg;

--
-- Name: blob_push_event_id_seq; Type: SEQUENCE; Schema: ozone_db; Owner: pg
--

CREATE SEQUENCE ozone_db.blob_push_event_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE ozone_db.blob_push_event_id_seq OWNER TO pg;

--
-- Name: blob_push_event_id_seq; Type: SEQUENCE OWNED BY; Schema: ozone_db; Owner: pg
--

ALTER SEQUENCE ozone_db.blob_push_event_id_seq OWNED BY ozone_db.blob_push_event.id;


--
-- Name: communication_template; Type: TABLE; Schema: ozone_db; Owner: pg
--

CREATE TABLE ozone_db.communication_template (
    id integer NOT NULL,
    name character varying NOT NULL,
    "contentMarkdown" character varying NOT NULL,
    subject character varying,
    disabled boolean DEFAULT false NOT NULL,
    "createdAt" timestamp with time zone,
    "updatedAt" timestamp with time zone,
    "lastUpdatedBy" character varying NOT NULL
);


ALTER TABLE ozone_db.communication_template OWNER TO pg;

--
-- Name: communication_template_id_seq; Type: SEQUENCE; Schema: ozone_db; Owner: pg
--

CREATE SEQUENCE ozone_db.communication_template_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE ozone_db.communication_template_id_seq OWNER TO pg;

--
-- Name: communication_template_id_seq; Type: SEQUENCE OWNED BY; Schema: ozone_db; Owner: pg
--

ALTER SEQUENCE ozone_db.communication_template_id_seq OWNED BY ozone_db.communication_template.id;


--
-- Name: kysely_migration; Type: TABLE; Schema: ozone_db; Owner: pg
--

CREATE TABLE ozone_db.kysely_migration (
    name character varying(255) NOT NULL,
    "timestamp" character varying(255) NOT NULL
);


ALTER TABLE ozone_db.kysely_migration OWNER TO pg;

--
-- Name: kysely_migration_lock; Type: TABLE; Schema: ozone_db; Owner: pg
--

CREATE TABLE ozone_db.kysely_migration_lock (
    id character varying(255) NOT NULL,
    is_locked integer DEFAULT 0 NOT NULL
);


ALTER TABLE ozone_db.kysely_migration_lock OWNER TO pg;

--
-- Name: label; Type: TABLE; Schema: ozone_db; Owner: pg
--

CREATE TABLE ozone_db.label (
    id bigint NOT NULL,
    src character varying NOT NULL,
    uri character varying NOT NULL,
    cid character varying NOT NULL,
    val character varying NOT NULL,
    neg boolean NOT NULL,
    cts character varying NOT NULL,
    exp character varying,
    sig bytea,
    "signingKeyId" integer
);


ALTER TABLE ozone_db.label OWNER TO pg;

--
-- Name: label_id_seq; Type: SEQUENCE; Schema: ozone_db; Owner: pg
--

CREATE SEQUENCE ozone_db.label_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE ozone_db.label_id_seq OWNER TO pg;

--
-- Name: label_id_seq; Type: SEQUENCE OWNED BY; Schema: ozone_db; Owner: pg
--

ALTER SEQUENCE ozone_db.label_id_seq OWNED BY ozone_db.label.id;


--
-- Name: moderation_event; Type: TABLE; Schema: ozone_db; Owner: pg
--

CREATE TABLE ozone_db.moderation_event (
    id integer NOT NULL,
    action character varying NOT NULL,
    "subjectType" character varying NOT NULL,
    "subjectDid" character varying NOT NULL,
    "subjectUri" character varying,
    "subjectCid" character varying,
    comment text,
    meta jsonb,
    "createdAt" character varying NOT NULL,
    "createdBy" character varying NOT NULL,
    "reversedAt" character varying,
    "reversedBy" character varying,
    "durationInHours" integer,
    "expiresAt" character varying,
    "reversedReason" text,
    "createLabelVals" character varying,
    "negateLabelVals" character varying,
    "legacyRefId" integer,
    "subjectBlobCids" jsonb,
    "addedTags" jsonb,
    "removedTags" jsonb,
    "subjectMessageId" character varying
);


ALTER TABLE ozone_db.moderation_event OWNER TO pg;

--
-- Name: moderation_event_id_seq; Type: SEQUENCE; Schema: ozone_db; Owner: pg
--

CREATE SEQUENCE ozone_db.moderation_event_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE ozone_db.moderation_event_id_seq OWNER TO pg;

--
-- Name: moderation_event_id_seq; Type: SEQUENCE OWNED BY; Schema: ozone_db; Owner: pg
--

ALTER SEQUENCE ozone_db.moderation_event_id_seq OWNED BY ozone_db.moderation_event.id;


--
-- Name: moderation_subject_status; Type: TABLE; Schema: ozone_db; Owner: pg
--

CREATE TABLE ozone_db.moderation_subject_status (
    id integer NOT NULL,
    did character varying NOT NULL,
    "recordPath" character varying DEFAULT ''::character varying NOT NULL,
    "blobCids" jsonb,
    "recordCid" character varying,
    "reviewState" character varying NOT NULL,
    comment character varying,
    "muteUntil" character varying,
    "lastReviewedAt" character varying,
    "lastReviewedBy" character varying,
    "lastReportedAt" character varying,
    "lastAppealedAt" character varying,
    takendown boolean DEFAULT false NOT NULL,
    "suspendUntil" character varying,
    appealed boolean,
    "createdAt" character varying NOT NULL,
    "updatedAt" character varying NOT NULL,
    tags jsonb,
    "muteReportingUntil" character varying
);


ALTER TABLE ozone_db.moderation_subject_status OWNER TO pg;

--
-- Name: moderation_subject_status_id_seq; Type: SEQUENCE; Schema: ozone_db; Owner: pg
--

CREATE SEQUENCE ozone_db.moderation_subject_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE ozone_db.moderation_subject_status_id_seq OWNER TO pg;

--
-- Name: moderation_subject_status_id_seq; Type: SEQUENCE OWNED BY; Schema: ozone_db; Owner: pg
--

ALTER SEQUENCE ozone_db.moderation_subject_status_id_seq OWNED BY ozone_db.moderation_subject_status.id;


--
-- Name: record_push_event; Type: TABLE; Schema: ozone_db; Owner: pg
--

CREATE TABLE ozone_db.record_push_event (
    id integer NOT NULL,
    "eventType" character varying NOT NULL,
    "subjectDid" character varying NOT NULL,
    "subjectUri" character varying NOT NULL,
    "subjectCid" character varying,
    "takedownRef" character varying,
    "confirmedAt" timestamp with time zone,
    "lastAttempted" timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL
);


ALTER TABLE ozone_db.record_push_event OWNER TO pg;

--
-- Name: record_push_event_id_seq; Type: SEQUENCE; Schema: ozone_db; Owner: pg
--

CREATE SEQUENCE ozone_db.record_push_event_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE ozone_db.record_push_event_id_seq OWNER TO pg;

--
-- Name: record_push_event_id_seq; Type: SEQUENCE OWNED BY; Schema: ozone_db; Owner: pg
--

ALTER SEQUENCE ozone_db.record_push_event_id_seq OWNED BY ozone_db.record_push_event.id;


--
-- Name: repo_push_event; Type: TABLE; Schema: ozone_db; Owner: pg
--

CREATE TABLE ozone_db.repo_push_event (
    id integer NOT NULL,
    "eventType" character varying NOT NULL,
    "subjectDid" character varying NOT NULL,
    "takedownRef" character varying,
    "confirmedAt" timestamp with time zone,
    "lastAttempted" timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL
);


ALTER TABLE ozone_db.repo_push_event OWNER TO pg;

--
-- Name: repo_push_event_id_seq; Type: SEQUENCE; Schema: ozone_db; Owner: pg
--

CREATE SEQUENCE ozone_db.repo_push_event_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE ozone_db.repo_push_event_id_seq OWNER TO pg;

--
-- Name: repo_push_event_id_seq; Type: SEQUENCE OWNED BY; Schema: ozone_db; Owner: pg
--

ALTER SEQUENCE ozone_db.repo_push_event_id_seq OWNED BY ozone_db.repo_push_event.id;


--
-- Name: signing_key; Type: TABLE; Schema: ozone_db; Owner: pg
--

CREATE TABLE ozone_db.signing_key (
    id integer NOT NULL,
    key character varying NOT NULL
);


ALTER TABLE ozone_db.signing_key OWNER TO pg;

--
-- Name: signing_key_id_seq; Type: SEQUENCE; Schema: ozone_db; Owner: pg
--

CREATE SEQUENCE ozone_db.signing_key_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE ozone_db.signing_key_id_seq OWNER TO pg;

--
-- Name: signing_key_id_seq; Type: SEQUENCE OWNED BY; Schema: ozone_db; Owner: pg
--

ALTER SEQUENCE ozone_db.signing_key_id_seq OWNED BY ozone_db.signing_key.id;


--
-- Name: moderation_action id; Type: DEFAULT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.moderation_action ALTER COLUMN id SET DEFAULT nextval('bsky.moderation_action_id_seq'::regclass);


--
-- Name: moderation_event id; Type: DEFAULT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.moderation_event ALTER COLUMN id SET DEFAULT nextval('bsky.moderation_event_id_seq'::regclass);


--
-- Name: moderation_report id; Type: DEFAULT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.moderation_report ALTER COLUMN id SET DEFAULT nextval('bsky.moderation_report_id_seq'::regclass);


--
-- Name: moderation_subject_status id; Type: DEFAULT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.moderation_subject_status ALTER COLUMN id SET DEFAULT nextval('bsky.moderation_subject_status_id_seq'::regclass);


--
-- Name: notification id; Type: DEFAULT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.notification ALTER COLUMN id SET DEFAULT nextval('bsky.notification_id_seq'::regclass);


--
-- Name: blob_push_event id; Type: DEFAULT; Schema: ozone_db; Owner: pg
--

ALTER TABLE ONLY ozone_db.blob_push_event ALTER COLUMN id SET DEFAULT nextval('ozone_db.blob_push_event_id_seq'::regclass);


--
-- Name: communication_template id; Type: DEFAULT; Schema: ozone_db; Owner: pg
--

ALTER TABLE ONLY ozone_db.communication_template ALTER COLUMN id SET DEFAULT nextval('ozone_db.communication_template_id_seq'::regclass);


--
-- Name: label id; Type: DEFAULT; Schema: ozone_db; Owner: pg
--

ALTER TABLE ONLY ozone_db.label ALTER COLUMN id SET DEFAULT nextval('ozone_db.label_id_seq'::regclass);


--
-- Name: moderation_event id; Type: DEFAULT; Schema: ozone_db; Owner: pg
--

ALTER TABLE ONLY ozone_db.moderation_event ALTER COLUMN id SET DEFAULT nextval('ozone_db.moderation_event_id_seq'::regclass);


--
-- Name: moderation_subject_status id; Type: DEFAULT; Schema: ozone_db; Owner: pg
--

ALTER TABLE ONLY ozone_db.moderation_subject_status ALTER COLUMN id SET DEFAULT nextval('ozone_db.moderation_subject_status_id_seq'::regclass);


--
-- Name: record_push_event id; Type: DEFAULT; Schema: ozone_db; Owner: pg
--

ALTER TABLE ONLY ozone_db.record_push_event ALTER COLUMN id SET DEFAULT nextval('ozone_db.record_push_event_id_seq'::regclass);


--
-- Name: repo_push_event id; Type: DEFAULT; Schema: ozone_db; Owner: pg
--

ALTER TABLE ONLY ozone_db.repo_push_event ALTER COLUMN id SET DEFAULT nextval('ozone_db.repo_push_event_id_seq'::regclass);


--
-- Name: signing_key id; Type: DEFAULT; Schema: ozone_db; Owner: pg
--

ALTER TABLE ONLY ozone_db.signing_key ALTER COLUMN id SET DEFAULT nextval('ozone_db.signing_key_id_seq'::regclass);


--
-- Data for Name: actor; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.actor (did, handle, "indexedAt", "takedownRef", "upstreamStatus") FROM stdin;
did:plc:bvvapistf6rfov6ptfsomeai	mod-authority.test	2024-06-07T12:43:06.513Z	\N	\N
did:plc:zluht54hsscg6octtayzd3ft	alice.test	2024-06-07T12:43:07.503Z	\N	\N
did:plc:5ssevsxo3qyovxpgkg3n2tfs	bob.test	2024-06-07T12:43:07.602Z	\N	\N
did:plc:awpz77o4dyluwpa2j2p2oqgs	carla.test	2024-06-07T12:43:07.716Z	\N	\N
did:plc:76yilut5e5rxswsgu6obixh7	triage.test	2024-06-07T12:43:07.811Z	\N	\N
did:plc:3lytao7vt6nllqo3iep3zx25	mod.test	2024-06-07T12:43:07.902Z	\N	\N
did:plc:mop2kmkfw7uk5rpc7ium6wo7	admin-mod.test	2024-06-07T12:43:07.999Z	\N	\N
did:plc:vb63kualusarrqqejvolrrv7	labeler.test	2024-06-07T12:43:13.677Z	\N	\N
\.


--
-- Data for Name: actor_block; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.actor_block (uri, cid, creator, "subjectDid", "createdAt", "indexedAt") FROM stdin;
\.


--
-- Data for Name: actor_state; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.actor_state (did, "lastSeenNotifs") FROM stdin;
\.


--
-- Data for Name: actor_sync; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.actor_sync (did, "commitCid", "commitDataCid", "rebaseCount", "tooBigCount", "repoRev") FROM stdin;
did:plc:bvvapistf6rfov6ptfsomeai	bafyreiesurrbbeyj6ylxt4k3aasteq67aklk25tmwpyzheuczvjcn2536i	bafyreibxqk65z7tttoghrrcrjl4k5g4xkzi6hxye3fqx346hgacuibp5vy	0	0	3kudkm4fhq222
did:plc:76yilut5e5rxswsgu6obixh7	bafyreigfkvsgkzswk6lpwtkwu3eqvtdp7um65ceqzeo4e3hsnweqxu6vti	bafyreie5737gdxlw5i64vzichcalba3z2v5n6icifvx5xytvske7mr3hpm	0	0	3kudkm5k7j222
did:plc:3lytao7vt6nllqo3iep3zx25	bafyreidsaagcsb6jndykrjnsectwnp2qw5mkvaocd7ofjjzx2dllpl4bri	bafyreie5737gdxlw5i64vzichcalba3z2v5n6icifvx5xytvske7mr3hpm	0	0	3kudkm5msjc22
did:plc:mop2kmkfw7uk5rpc7ium6wo7	bafyreibvqqzoxel4qoicnejdictq5aklrgk2pzsmg3q7ubwwajb5h4tuvm	bafyreie5737gdxlw5i64vzichcalba3z2v5n6icifvx5xytvske7mr3hpm	0	0	3kudkm5pkfs22
did:plc:awpz77o4dyluwpa2j2p2oqgs	bafyreid4rs6cq4pm436ty3u5fucqkuglthdtznawoify4ofeqcfrrefd3a	bafyreicrpqdv3dtdedhq6ypjs77llmcbsedzqwtkmakuinktak5gbtrvs4	0	0	3kudkmd2k3k22
did:plc:zluht54hsscg6octtayzd3ft	bafyreihb5ytp5v7wg3ll4ntuazqynfyl4ifcrqcl6hr75bsyxgyv2cehom	bafyreif77267cqvvai5kjbpalp46naybpyazduciorjvaooy47ro73wsie	0	0	3kudkmdckwc22
did:plc:5ssevsxo3qyovxpgkg3n2tfs	bafyreibd3oxl22mvqhluqpxcij2vrwm52ovqybn3yb3bqk5fz3zbvekcsm	bafyreiac3f33yvcat27xzldnjqqtrzzvfo7kr5ohncx43pjji74aoojvai	0	0	3kudkmdd4is22
did:plc:vb63kualusarrqqejvolrrv7	bafyreigdrdwksto3nkxz2joxp2pby2bch56yyudewpd2hhc7kidtxzyj4e	bafyreid2epjwurme64zbhmqii4zoopdu4dtnaq4lwi4xbfid65b44txspq	0	0	3kudkmd7l7s22
\.


--
-- Data for Name: blob_takedown; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.blob_takedown (did, cid, "takedownRef") FROM stdin;
\.


--
-- Data for Name: did_cache; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.did_cache (did, doc, "updatedAt") FROM stdin;
\.


--
-- Data for Name: duplicate_record; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.duplicate_record (uri, cid, "duplicateOf", "indexedAt") FROM stdin;
\.


--
-- Data for Name: feed_generator; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.feed_generator (uri, cid, creator, "feedDid", "displayName", description, "descriptionFacets", "avatarCid", "createdAt", "indexedAt") FROM stdin;
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.generator/alice-favs	bafyreidysakacrh2omr5ht5zb4xw2w46m7ngjitvefjzjzkt6qo6xjowfq	did:plc:zluht54hsscg6octtayzd3ft	did:plc:42bwvozd4pfiem3axjy2xmkd	alices feed	all my fav stuff	\N	bafkreihem6nzbu462kcx5cqnrkonpq75fe5dlbhgnzcmuvvhqk7s5vcq3u	2022-07-15T00:51:24.914Z	2024-06-07T12:43:13.470Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.generator/bob-redux	bafyreibwqt7zwvetxo2tbjdgcgo2gbjjppyce7by46tvagdtu2kze26i5a	did:plc:5ssevsxo3qyovxpgkg3n2tfs	did:plc:45kv53dueypnb4atit4fugs6	Bobby boy hot new algo	\N	\N	\N	2022-07-15T00:51:29.914Z	2024-06-07T12:43:13.570Z
\.


--
-- Data for Name: feed_item; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.feed_item (uri, cid, type, "postUri", "originatorDid", "sortAt") FROM stdin;
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:47:17.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm5zpm222	bafyreibl6nrxujzusdkawwdxoegdgbysqt3wu7xrpimtyeqij4ldrdpvt4	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm5zpm222	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:47:18.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22	bafyreicwid24ntku3kmqruypwpgsdkpanhg2emvdvbkuvn3fmppxzlhdqa	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:47:19.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm63k7222	bafyreidwwfbydjpoh5pm363uhfzdejxsuutwm4cpsv2ptht4x5q5ug22by	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm63k7222	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:47:20.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22	bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:47:21.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64eks22	bafyreiahrxynudxg5rk76kw5mbcr65gjuli76szgmm3m3bso6ewxtkyngq	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64eks22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:47:22.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65frc22	bafyreidwj4haslqlsrycp5uc2kaoupd5vbgaoxzsxzbwwydcguec4catcu	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65frc22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:47:24.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm66hx222	bafyreidxjakkbifqysatmszjyvoa3usbnenyadx2dvxhebektepcvu4hry	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm66hx222	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:47:26.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22	bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:47:23.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:47:25.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22	bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:47:27.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6ax2c22	bafyreicphr7ig7gn4uabxqoocganwhi5njug2flpfc2m4ggdirmgiu5glq	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6ax2c22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:47:28.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6bhnk22	bafyreiceit7gbs5xammejxeej665pnliyxyogmf4fqkvmakundsmd7mooe	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6bhnk22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:47:29.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6cnqc22	bafyreid273gys3wrzpedo7uguxwxq6c5iqyji63uqrbxq7xd2v5645rrja	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6cnqc22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:47:31.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22	bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:47:33.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6c27c22	bafyreiajg2rg4ysiluze35qqjdymgc7sy34ovwssevuqpvxvxozsodocp4	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6c27c22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:47:30.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6er4k22	bafyreifed7rbzncumo543gdaydnaprdl2aokx725gk6cfruqimwngkfw2e	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6er4k22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:47:35.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22	bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:47:32.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.repost/3kudkm6e6ks22	bafyreihkqndhv2u3jpzos2uiugmuylwfe33x6zmqnq4x47y2hf7d4cmuoe	repost	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm5zpm222	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:47:34.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22	bafyreifsazs5bwjay324fnkz5ecluwy4bpehh5iwdkwmerj7ywhjj7pcnq	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:47:36.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6k6x222	bafyreicbtupktruxgtg3wyw3ptx6ntmmchwyapczem2p24cbhynm24amxm	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6k6x222	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:47:37.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6lgyc22	bafyreiarenp2r55zrv52fnig3wyttvdcluenvbu2m3oqte7qn4js54f5dq	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6lgyc22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:47:39.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6kpkc22	bafyreiabae2vvj5z2jaqmxsmskvay5gnmlgiump7ol2kgebvnwhyacr5ou	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6kpkc22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:47:38.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6m2jc22	bafyreigfwyy5uw74g2gkfilquplidccubgxpvdihuvwjnkag2iogetp5fu	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6m2jc22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:47:40.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22	bafyreicyq7eldus5jwjulcgmbijfzkiqyfbnoo74fmowj5n2ydxqc4q7he	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:47:41.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ndjs22	bafyreibbfl3v22jf4vneuwi3wy73d3t2xnqdc4cnb6dqhh4oxwqf6xuxsm	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ndjs22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:47:42.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6pppc22	bafyreibd6kqdmg5bvqvfme3nu76crz5hpdygbuvtfo5z6gmn73pm23c4bi	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6pppc22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:47:46.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6nw3k22	bafyreicznkuorm6ypgy3cgltnqqfncnhd2ddueiwfotpubqfinepkrsm74	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6nw3k22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:47:43.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6oho222	bafyreidztf4duw63m5xb6uisugocsmehokjp6sb7jyjqwxmu65pyt34s7m	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6oho222	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:47:44.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6t62k22	bafyreia4smzotwpndfww2bxdmhqgovxq7pas5klmjwg2czsx2z6cv56e6m	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6t62k22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:47:51.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6v7ic22	bafyreihafcvgqpktxi7ugcwgfru5pm77due6skn6gkkqdq7jw7uodnzwxy	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6v7ic22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:47:54.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6wiis22	bafyreigfuziopyoqcyv5jx6n7farmuxqmt6o3eeyszctl2xveyahtucnhe	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6wiis22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:47:56.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6zuvk22	bafyreihjmjhi6ovt77ffrwdttf4m2xmfi6ug5wczn2xccetuw2nj2racd4	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6zuvk22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:48:01.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm75mzc22	bafyreihwcj7qlqtq4iwyi7vez4bf4akjqjpeysaxqcoyzvg5dgvuzofip4	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm75mzc22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:48:07.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7blxs22	bafyreigzrkdypcw6rzkdswhct6ay552cpzukzcfmrdxdhfi4tx2bfg3yaq	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7blxs22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:48:12.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7j2as22	bafyreih3yrxva7euqbsiozt473ou6giubfjq5dujecdoehkr7vuggkfxsu	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7j2as22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:48:23.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7mcqk22	bafyreibc6lqv5cla3g6xfubafiwapmfzvgbakgfwgcwcjkiwpaj4wyooqm	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7mcqk22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:48:28.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7of5k22	bafyreibjpq4ipgtmol5ckai6544ipyqmvevvjakzc4x46ac3jhfyrm7gfy	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7of5k22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:48:31.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7qglc22	bafyreiduw3nbbzfjcxoa37imhi5qtdkjr2bkxgq6k4srpwpab6zpgcxlqm	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7qglc22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:48:34.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7uank22	bafyreigb5ssh4mbqyaylhacmzhnt6oiltbpirhmqazmtbpswbfbysflgn4	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7uank22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:48:40.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7vjo222	bafyreif3qimkdrmai7smpokzs7u5tx6uuwvf22xta7rvijwtcxyi2rao64	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7vjo222	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:48:42.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7wa4s22	bafyreiajzithxxyp3pm5rzwxs4iz6ej4nfo7jj5y3uk77nxfd4o5hxjgza	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7wa4s22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:48:43.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7ymcc22	bafyreicdlrtocb5hivmgg5vfcas2bypsrk64dehthoqhjmkvl64o6kpgqy	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7ymcc22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:48:46.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkma5z5k22	bafyreidtr62xflznx7wov2vsnlzhrosvckdvf4wxcxelae6psf45js2g7m	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkma5z5k22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:48:54.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma4s3k22	bafyreih6ycrwvvvewm65opmzr2w2bgbfza4o674talhlcddpixp5mf6mv4	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma4s3k22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:48:52.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmafobc22	bafyreickokrszbu3fyh7ebesnizvfq627h3hzsh5m2vkyjqqkx2ajidq2m	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmafobc22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:49:04.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmaig5s22	bafyreihjk3euvxnwb34irk5rszmtai57cv5zayb6tdffswiljtylv6xu6y	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmaig5s22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:49:07.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmajvz222	bafyreibcdzdfzu6gp6maiw2aopnyop6njhp4z7s4gtdy4paifyngjcfnze	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmajvz222	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:49:09.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6qcb222	bafyreideidtqpviy6deov3hiv2bph4ngud6snrf3rqj62e7n56me3accuy	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6qcb222	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:47:47.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6qxqk22	bafyreigytipb36mr5photttbnc7yrmy75tnwvcvohx3kg56vod5n522slq	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6qxqk22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:47:48.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6vszc22	bafyreifgmn2zhq5qstdcc77yedzggkow3gz67c6daubgntpqi7uktqkpam	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6vszc22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:47:55.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm77cq222	bafyreifxrysbjhvhafppbgxwgg6tm6ye4iq56d6wft5ivjo6tyu7yke3be	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm77cq222	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:48:09.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7fjx222	bafyreigtv3xbvf7zecdzzaljrirvng6dn25cuzu2s7vrwejalkx3boli7e	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7fjx222	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:48:18.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7l2pc22	bafyreicho5whst5kg2exmu7jl4yk7iyihmpqqkvdqx2sa4tkitxsdxsrgu	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7l2pc22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:48:26.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7pn6s22	bafyreigvlrrozbjn3gxkcp44pspjbmtawgdxjw7qytnv2ts3rtqzgvpsqy	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7pn6s22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:48:33.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7qz5222	bafyreihxtuaj4wfbyqjyswvscr5y7m7e7ojymxltfvrcyilg7z3yu5t7bi	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7qz5222	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:48:35.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7sxn222	bafyreihnw6l32rjmtkvt5s56doimw5lfu2ymwfqftnlc2euhdcmmnlqnz4	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7sxn222	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:48:38.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7uw5222	bafyreieouj26ubtzwd43olrtigwuhdlj4e555waytjfp65lp4wahvh6eva	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7uw5222	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:48:41.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7xk4k22	bafyreicbzb7gpl5n6syjqqzgix6cejwvmz7aquf2sgbkq7gt7zinc34s6y	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7xk4k22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:48:45.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7zepk22	bafyreiavtz5pbqpzdwdns6cuk7tijrjueb7am77rdihyx3in5ytparccda	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7zepk22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:48:47.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma5enc22	bafyreifhrml2m2oqyue37mn2iwlsirdnpjues76yufy5invzhigguanita	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma5enc22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:48:53.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma46kk22	bafyreicgt73gbvybblwvgog63c73uoyvzkiwpflu2zi2dbywpnafz3r7mi	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma46kk22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:48:51.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma7h2c22	bafyreidrqkwmhh2yxhpkbisqufrib2mysgrztuof6s2ur6p7362n5ozk4q	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma7h2c22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:48:56.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmac3z222	bafyreiahz6chrakkw7en4ceothts6uyxlualmbsgaaaruneiouc4t4uqa4	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmac3z222	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:48:59.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6sar222	bafyreih5bwjxfretqbmnmtnh2nmfoxrugkrsydmgo73izz26k64mxtxshy	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6sar222	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:47:50.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm72ncs22	bafyreifsu7lckdjbk6tunuxynocyxwfcwafnjsysnyjqtxpse53jj3eyru	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm72ncs22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:48:02.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm73bt222	bafyreih3vtpmaliuufzvmvp2xh74kgwpnnam7axm3c24o6besdvqzg3bg4	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm73bt222	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:48:03.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm73ues22	bafyreigntykfl6qep45vt6wq46qrs7huq5opddpw5z2glomc24p2mdfjty	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm73ues22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:48:04.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7eetk22	bafyreicktcft44xal23bti6zihdlbldfrjii7r3zuro5djfbdmmrle5rem	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7eetk22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:48:16.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7tm5c22	bafyreidvpfwzrp7zlftziynbgybw2d5vh36yirkrtvwollweu7o2i4l4ki	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7tm5c22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:48:39.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7wtns22	bafyreihgh57cwdh3kywwadabvhnfpfrsvhmuugl5otz4xfsgsja7uhv2qm	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7wtns22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:48:44.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma3k2c22	bafyreiaw2qpwzp6x6jlx5rzzknelrsajqi2titcwmji625na6xcglyiv4q	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma3k2c22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:48:50.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma6pmc22	bafyreicocopqz3vmrs7ndsx7l7rnph3sqpdoshml7f6vx4m2klvzkjpa24	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma6pmc22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:48:55.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmaa4js22	bafyreiad2yqm6qwrpshalzscz644qp3osayprmcddvhwo2dywiqffrm2bi	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmaa4js22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:48:57.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmaeaek22	bafyreihkzh7ny5yrxqemvybg3i7777fj7mfnde6xeyrt4wmxjs5rljgoge	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmaeaek22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:49:02.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmagjmc22	bafyreiapglbozxgvrngr3i56brbaukc5udsdbwsmmp7axguqscbtavuz6m	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmagjmc22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:49:05.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmamvpk22	bafyreigzm756fmbrj22rhawr7cojojnc7g3bu32rzjw6armvhpfjvvkgz4	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmamvpk22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:49:13.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6rna222	bafyreifuxoreut7uuibyzm5wmrl2wefsc4e3ksoeunj4k5fmntrciairi4	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6rna222	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:47:49.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6p55k22	bafyreid2w2wi55ko3m3lcj6puvrywdcfey2dapgg2raddqvcjq5jxkw6be	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6p55k22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:47:45.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6twhs22	bafyreiazf5m4p3ly542yppowxjctwxq6bo7wqn3vxhwlw4zf6gafagjdmi	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6twhs22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:47:52.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xaw222	bafyreiaip7e3kif6rhhvkx4dckwbm3egog6sn7kkf4x5e2puj6d4lkit2m	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xaw222	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:47:57.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6zbek22	bafyreibs7cdwlfhlykogfpj5yimdk62ttoq5gn4akjk65zykistm4pk7cy	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6zbek22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:48:00.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm74gwk22	bafyreibjfpn3ozc6rjzkjytahzatd77uarqqnnswivuvi2suhdycsmcflu	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm74gwk22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:48:05.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm76di222	bafyreict3zjalmndopvzm4rd5nzx2lz3spqnphfzifmoz7f3odke2jqptq	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm76di222	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:48:08.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7aby222	bafyreicwdnl52rm2basxdhgvcwvmac6iesq34njgbbschzx4usgzsf42ei	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7aby222	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:48:10.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7dqdc22	bafyreig63wu7skovixex2waesavh2ifjmbxbgohfggaag35kkmovwh2u7u	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7dqdc22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:48:15.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7exfc22	bafyreidc3o4sc4xts5dchqstdesgsca2nwtmgjl3ipbtef47bludcr6wry	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7exfc22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:48:17.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7gvvc22	bafyreiglrva5gmt5mumpuj55c2wxbnknijfsztiz6n7imalmlv63a4bhk4	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7gvvc22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:48:20.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7hles22	bafyreiat6kavehlet5nmwsgctjpeukavhtkalikajn54efgle2mmv2opzu	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7hles22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:48:21.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7ihp222	bafyreictq5xj4uggp3kaonouugalckasgzcvihlygzrbgnkz3npv3umhyu	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7ihp222	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:48:22.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7jpqc22	bafyreiarkx6bnx7jvqoqbq7aozirex5v2356rf2zztbuuwxxfnn7ibqoly	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7jpqc22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:48:24.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7keak22	bafyreib5eet7fqeo3c7yujtnsvudsfcb44tmzxhcvxa6ogev2q6t5yfa5q	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7keak22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:48:25.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7lp7k22	bafyreibtftyjrbiemgppzwvro2sm3mqryfdya3wuuqw3q7vcfproc6z5a4	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7lp7k22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:48:27.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7npo222	bafyreifktbxrueu6rfzzmsva4wn6cso23x4qrxcjqgrrk4f6upo4t6dd2m	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7npo222	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:48:30.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7p2n222	bafyreigiqmzmew4cu6eeualqhurezkrtsunelk3hnzpc7ot3o23lhornvq	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7p2n222	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:48:32.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7rkpk22	bafyreifl3toeqtvxgbdmp6ov6mcxxivj2entj66xn4x4kfvpp42m7gqr5q	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7rkpk22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:48:36.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7s6ak22	bafyreiaccvsbkagfya76xdapjcg7ifgmt5fqew4sljcptcbqdlso3rkqpy	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7s6ak22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:48:37.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmadluc22	bafyreiccumm4iihqjafzdjj4lhtzwusrwnuefibe4nm3ja337y7zwoqmse	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmadluc22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:49:01.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmahcys22	bafyreiazaf56e45jmxntxyybs6hvwujxn4t23nf25oa76nzrn43jnlctoy	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmahcys22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:49:06.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmanm6c22	bafyreihvzfls3zk4ev6s5p3r6ax3e3rrkhw5njjjb3yggnspydxhvhu7aa	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmanm6c22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:49:14.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmapbv222	bafyreihth3a7rf7n34zk5dfqnxbaijjey52lznc6sr6xwu7tap7lu65az4	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmapbv222	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:49:16.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmaqlus22	bafyreicoh73xyye3txq6ooqie3h5jv62zyt4mu362kvszxkxmczef6xu5u	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmaqlus22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:49:18.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6uky222	bafyreidokrfnhzk5mnwcicnvw7cuorg2qgnpotk2vicwcuhxeua2cxwur4	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6uky222	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:47:53.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xxes22	bafyreidqo3vj5ry5kvsm4srfutz27dtzkmqdzcq7sxouhcmxslcybcqf4m	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xxes22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:47:58.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6yoss22	bafyreifet3tq7lfikiwmcbp4puqxs5vl35otyg4skzvqdjjtq75juzazxq	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6yoss22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:47:59.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm74zic22	bafyreibom4ih33aggpyno5jlmjlaxjybicxr3wcotkmaf4xqila67dnhhu	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm74zic22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:48:06.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7awic22	bafyreie5deuo4q3cbbfcms72ew3fhnpljyclzrqfc7ybathfcj54lyqu4e	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7awic22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:48:11.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7cbhc22	bafyreiczpp4iuoulzhklxt5adsz7eamtxr5pq45bnm2g4pa2opidgc2r3u	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7cbhc22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:48:13.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7czuk22	bafyreigjauenhx5xcfji4c6sw7ghv2nz2p2yz4alespogrf7r7l5nexazq	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7czuk22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:48:14.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7gafs22	bafyreibw5y2w5tkkh3lwespoggcetavx2pmxnm6owicueqocrppxeftokq	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7gafs22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:48:19.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7mz7c22	bafyreid5ptmaadcgwqbehrtblhngprsk6dg2jwmc2j3zosfq7rdn57ztcy	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7mz7c22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:48:29.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma227222	bafyreiezftduzsjzbgjfyxkli3vbre3jybpgkilyvpfnhfoxfjthry3byy	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma227222	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:48:48.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma2qns22	bafyreidnyqv4p7iwm2tuoi7pfhkqpa3qwwwjsubu6tjxzwianersoc22qi	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma2qns22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:48:49.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmab2sk22	bafyreifwkhtulxci2yl7bbiq5u4gs2d34ldi5o73svdvakfknp4g73ula4	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmab2sk22	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:48:58.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmacugc22	bafyreigxi6u33zlzunwuosrs73xgn6335oi7p3c4ulzqfedyoqffkt6li4	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmacugc22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:49:00.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmaexsk22	bafyreia25f2teavzep54pf5lpmj2c5cstertmc6uzsit6vt72k7bqlb4cm	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmaexsk22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:49:03.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmaj7kc22	bafyreic5guwbepjlbejxy5lpjcmnkjgkbjn5bdtyp3hy6uzr57hyev2ify	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmaj7kc22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:49:08.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmakqes22	bafyreieqb5mec6ke3bstogsks46ka4hvgop7skmyvwasgigwsb4l4wm6ji	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmakqes22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:49:10.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmalis222	bafyreiasu4pjf66p3od3o2mxzct6ivvz43tmghpanlhjnaotmk5hs4pq3y	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmalis222	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:49:11.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmam7as22	bafyreidnh6h34yqwjgg65zdxkd35jms6vggpkc3abjojoy2bjcrmbb3f6i	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmam7as22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:49:12.914Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmao7pc22	bafyreiaagbmljfnqkwpppijmq2rc5ld25ohrvvcsyw2ilzbsvz5wqdh5l4	post	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmao7pc22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:49:15.914Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmapzd222	bafyreid3xstgek64pqr2zq6bohxi4vkfqmyr7e4wjsprguho5av3oz4ec4	post	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmapzd222	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:49:17.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmcyojc22	bafyreibp35vdsghs6j6yn6fcmr52tc4qzlab3uklmeev2o5lu5mhvjo5tu	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmcyojc22	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:51:25.914Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmd3t4222	bafyreihvhntyj52zza4vxgzqooioxxuzhnxiqyxsijqk4lxgjc6ftoeuue	post	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmd3t4222	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:51:30.914Z
\.


--
-- Data for Name: follow; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.follow (uri, cid, creator, "subjectDid", "createdAt", "indexedAt") FROM stdin;
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.graph.follow/3kudkm5vhuc22	bafyreifj5ej3fcuh573kjf4u7p6r35erckbijdu72wxrq5rnfb7uof7yyu	did:plc:5ssevsxo3qyovxpgkg3n2tfs	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:47:13.914Z	2024-06-07T12:43:08.138Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.graph.follow/3kudkm5uimc22	bafyreiexnx6mlny6ejitqpq6pmgzmmudlwnjv4leiyzseqi2ftlsyhr5xe	did:plc:zluht54hsscg6octtayzd3ft	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:47:11.914Z	2024-06-07T12:43:08.106Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.graph.follow/3kudkm5wkzc22	bafyreienbm2q5mu7n4dogfc5orrzwdcqk2wdfzgmtbzs4xxc5vvy43gu4q	did:plc:awpz77o4dyluwpa2j2p2oqgs	did:plc:zluht54hsscg6octtayzd3ft	2022-07-15T00:47:15.914Z	2024-06-07T12:43:08.173Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.graph.follow/3kudkm5x5l222	bafyreidjrfcbto7z7owmtpeyvs7lifd6ljwtocx5mmbajdfonlk6mv5hyu	did:plc:awpz77o4dyluwpa2j2p2oqgs	did:plc:5ssevsxo3qyovxpgkg3n2tfs	2022-07-15T00:47:16.914Z	2024-06-07T12:43:08.194Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.graph.follow/3kudkm5uxb222	bafyreigbxvp7wtwgo26ljetfqsngijk2e2ko744i4uyy36xgs7hh624u7y	did:plc:zluht54hsscg6octtayzd3ft	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:47:12.914Z	2024-06-07T12:43:08.122Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.graph.follow/3kudkm5vzgs22	bafyreie7m5mbj46oiwd56pvlhsvszlhkqtrst65ssn3hfncjv3g5zfylm4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	did:plc:awpz77o4dyluwpa2j2p2oqgs	2022-07-15T00:47:14.914Z	2024-06-07T12:43:08.156Z
\.


--
-- Data for Name: kysely_migration; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.kysely_migration (name, "timestamp") FROM stdin;
_20230309T045948368Z	2024-06-07T12:43:05.597Z
_20230408T152211201Z	2024-06-07T12:43:05.610Z
_20230417T210628672Z	2024-06-07T12:43:05.662Z
_20230420T211446071Z	2024-06-07T12:43:05.669Z
_20230427T194702079Z	2024-06-07T12:43:05.673Z
_20230605T144730094Z	2024-06-07T12:43:05.690Z
_20230607T211442112Z	2024-06-07T12:43:05.701Z
_20230608T155101190Z	2024-06-07T12:43:05.725Z
_20230608T201813132Z	2024-06-07T12:43:05.759Z
_20230608T205147239Z	2024-06-07T12:43:05.766Z
_20230609T153623961Z	2024-06-07T12:43:05.781Z
_20230609T232122649Z	2024-06-07T12:43:05.792Z
_20230610T203555962Z	2024-06-07T12:43:05.799Z
_20230611T215300060Z	2024-06-07T12:43:05.806Z
_20230620T161134972Z	2024-06-07T12:43:05.808Z
_20230627T212437895Z	2024-06-07T12:43:05.810Z
_20230629T220835893Z	2024-06-07T12:43:05.817Z
_20230703T045536691Z	2024-06-07T12:43:05.828Z
_20230720T164800037Z	2024-06-07T12:43:05.832Z
_20230807T035309811Z	2024-06-07T12:43:05.836Z
_20230808T172902639Z	2024-06-07T12:43:05.838Z
_20230810T203349843Z	2024-06-07T12:43:05.839Z
_20230817T195936007Z	2024-06-07T12:43:05.847Z
_20230830T205507322Z	2024-06-07T12:43:05.854Z
_20230904T211011773Z	2024-06-07T12:43:05.864Z
_20230906T222220386Z	2024-06-07T12:43:05.876Z
_20230920T213858047Z	2024-06-07T12:43:05.877Z
_20230929T192920807Z	2024-06-07T12:43:05.889Z
_20231003T202833377Z	2024-06-07T12:43:05.917Z
_20231220T225126090Z	2024-06-07T12:43:05.933Z
_20240124T023719200Z	2024-06-07T12:43:05.940Z
_20240226T225725627Z	2024-06-07T12:43:05.950Z
_20240530T170337073Z	2024-06-07T12:43:05.952Z
\.


--
-- Data for Name: kysely_migration_lock; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.kysely_migration_lock (id, is_locked) FROM stdin;
migration_lock	0
\.


--
-- Data for Name: label; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.label (src, uri, cid, val, neg, cts) FROM stdin;
did:example:labeler	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6k6x222	bafyreicbtupktruxgtg3wyw3ptx6ntmmchwyapczem2p24cbhynm24amxm	nudity	f	2024-06-07T12:43:08.835Z
did:example:labeler	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6kpkc22	bafyreiabae2vvj5z2jaqmxsmskvay5gnmlgiump7ol2kgebvnwhyacr5ou	dmca-violation	f	2024-06-07T12:43:08.838Z
did:plc:vb63kualusarrqqejvolrrv7	did:plc:zluht54hsscg6octtayzd3ft		rude	f	2024-06-07T12:43:13.709Z
did:plc:vb63kualusarrqqejvolrrv7	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.generator/alice-favs		cool	f	2024-06-07T12:43:13.712Z
did:plc:vb63kualusarrqqejvolrrv7	did:plc:5ssevsxo3qyovxpgkg3n2tfs		cool	f	2024-06-07T12:43:13.714Z
did:plc:vb63kualusarrqqejvolrrv7	did:plc:awpz77o4dyluwpa2j2p2oqgs		spam	f	2024-06-07T12:43:13.716Z
\.


--
-- Data for Name: labeler; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.labeler (uri, cid, creator, "createdAt", "indexedAt") FROM stdin;
at://did:plc:bvvapistf6rfov6ptfsomeai/app.bsky.labeler.service/self	bafyreibtfmdstlnokwsgxhtkmjgrls6gd5wrrn2pkijrfg4f7rb37r2kfq	did:plc:bvvapistf6rfov6ptfsomeai	2024-06-07T12:43:06.540Z	2024-06-07T12:43:06.563Z
at://did:plc:vb63kualusarrqqejvolrrv7/app.bsky.labeler.service/self	bafyreiao2my2jhxscjw5ru5ymehfqnyuu64ow5tyzu5thcp4bgfjjvvoam	did:plc:vb63kualusarrqqejvolrrv7	2022-07-15T00:51:31.914Z	2024-06-07T12:43:13.708Z
\.


--
-- Data for Name: like; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky."like" (uri, cid, creator, subject, "subjectCid", "createdAt", "indexedAt") FROM stdin;
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmar4i222	bafyreiggkxvej75yamo77xvn52ua3uq5g6bonyq66ewaon4zzjn6cit6am	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	2022-07-15T00:49:19.914Z	2024-06-07T12:43:11.142Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmaro2k22	bafyreictjlrfx3cwbs4pkyt4ykdhd72hlvdox3we4nonghs3psqajn32p4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	2022-07-15T00:49:20.914Z	2024-06-07T12:43:11.158Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmast6222	bafyreiby3sbbeqllhigf3nfgcgwcqcedfizyjpoqcvuv6iurntshkynmpu	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm5zpm222	bafyreibl6nrxujzusdkawwdxoegdgbysqt3wu7xrpimtyeqij4ldrdpvt4	2022-07-15T00:49:22.914Z	2024-06-07T12:43:11.196Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmas7n222	bafyreih62t2lumuzt33dvegh4s2crnblumru5gllko4rfphn25lbo4s7ja	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	2022-07-15T00:49:21.914Z	2024-06-07T12:43:11.179Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmatsg222	bafyreicsjstocs4sqjdobzetcacji4eawzizngrnuvdzsy5vdjvlyri4hm	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22	bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e	2022-07-15T00:49:24.914Z	2024-06-07T12:43:11.228Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmatcs222	bafyreidgreob26umndt3fictf3aj6p57ntlw3ung3rixldeomvlv3n6ggy	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm63k7222	bafyreidwwfbydjpoh5pm363uhfzdejxsuutwm4cpsv2ptht4x5q5ug22by	2022-07-15T00:49:23.914Z	2024-06-07T12:43:11.211Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmauro222	bafyreieofchcqoyt5go7hu2fhuprgcvltgoiqawrsbl5eprxs7o7xg6sbq	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64eks22	bafyreiahrxynudxg5rk76kw5mbcr65gjuli76szgmm3m3bso6ewxtkyngq	2022-07-15T00:49:26.914Z	2024-06-07T12:43:11.261Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmavbc222	bafyreiaxx24ae4ps5ugsiqrpdwnb7cg3osgzddhbpehjkc7tgr5ngtj5nq	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64eks22	bafyreiahrxynudxg5rk76kw5mbcr65gjuli76szgmm3m3bso6ewxtkyngq	2022-07-15T00:49:27.914Z	2024-06-07T12:43:11.279Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmauc2222	bafyreidzxdph7qb72edbbg45jqtq3qfuwwkvgnzcpboyjceqclpffhbksy	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22	bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e	2022-07-15T00:49:25.914Z	2024-06-07T12:43:11.244Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmavut222	bafyreianjkzgikv2tdrwsqhmmhtvziwrfa2l3i2eay5sauxyzrc33iibgu	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22	bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu	2022-07-15T00:49:28.914Z	2024-06-07T12:43:11.295Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmawvzk22	bafyreib45y4vrwkud2iudseoeayyqxbpt6ieaj5pizntqs7jsewc5dietm	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by	2022-07-15T00:49:30.914Z	2024-06-07T12:43:11.330Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmaweh222	bafyreideunwwwbmgynidmrn3iopxf7s5jrquyu6ay6f2wuhqdvyd5r5tta	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65frc22	bafyreidwj4haslqlsrycp5uc2kaoupd5vbgaoxzsxzbwwydcguec4catcu	2022-07-15T00:49:29.914Z	2024-06-07T12:43:11.313Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmaxgms22	bafyreigx6de6nh4rphd2ugsudtcbpthevbz77n2bnh67xvrxowqpfludy4	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm66hx222	bafyreidxjakkbifqysatmszjyvoa3usbnenyadx2dvxhebektepcvu4hry	2022-07-15T00:49:31.914Z	2024-06-07T12:43:11.348Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmaxz6k22	bafyreicybv3yh4ct7jxsftjcnb6rsxv5g7zsnx3v4ebe2fr7hx32s7sru4	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22	bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm	2022-07-15T00:49:32.914Z	2024-06-07T12:43:11.366Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmayisk22	bafyreig5wlolcabfgqxrgq3xanzybvlwlm76ms3fqsmwv3aqachu33yuuy	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22	bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm	2022-07-15T00:49:33.914Z	2024-06-07T12:43:11.385Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmazmws22	bafyreib34xvqst3kwka5cvzqajl7wmif6hyh6rspd23yndilzqm4zkkery	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6bhnk22	bafyreiceit7gbs5xammejxeej665pnliyxyogmf4fqkvmakundsmd7mooe	2022-07-15T00:49:35.914Z	2024-06-07T12:43:11.419Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmb24ks22	bafyreiahh4xmqyp3tz7m67da4he2666fbsfnkm3x6gws7z4heveto6soba	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6c27c22	bafyreiajg2rg4ysiluze35qqjdymgc7sy34ovwssevuqpvxvxozsodocp4	2022-07-15T00:49:36.914Z	2024-06-07T12:43:11.434Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmaz4dk22	bafyreigpveeovmzswbncal3xm2i6y6jiavtwijaih2amhoaqftzcbruwka	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6ax2c22	bafyreicphr7ig7gn4uabxqoocganwhi5njug2flpfc2m4ggdirmgiu5glq	2022-07-15T00:49:34.914Z	2024-06-07T12:43:11.402Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmb2m6s22	bafyreig5abqx2bk23juysvt43yezs6prgabsei5paoncb3syt347nf73f4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22	bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4	2022-07-15T00:49:37.914Z	2024-06-07T12:43:11.451Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmb33ss22	bafyreicsma5f6scg2tqsq5z3geinqacadaqm7xfnlrrbzuhzxatuwgrcja	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22	bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4	2022-07-15T00:49:38.914Z	2024-06-07T12:43:11.467Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmb3lgs22	bafyreibrpb73tegzpxfj7gsitxxix67c7gtnpvkt3oka2g3n6omzfcpkea	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6er4k22	bafyreifed7rbzncumo543gdaydnaprdl2aokx725gk6cfruqimwngkfw2e	2022-07-15T00:49:39.914Z	2024-06-07T12:43:11.486Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmb4ols22	bafyreieslouhakj57ncxbfbaostrjusizn6qu6ylcxlozredalejwycuaa	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6lgyc22	bafyreiarenp2r55zrv52fnig3wyttvdcluenvbu2m3oqte7qn4js54f5dq	2022-07-15T00:49:41.914Z	2024-06-07T12:43:11.519Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmb6p2c22	bafyreid3acqebze55x7m74nuro2w75aiedkfelpxb4zb32xjudevqszpom	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ndjs22	bafyreibbfl3v22jf4vneuwi3wy73d3t2xnqdc4cnb6dqhh4oxwqf6xuxsm	2022-07-15T00:49:45.914Z	2024-06-07T12:43:11.585Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbctuc22	bafyreidvq4gvnuv4xljymgksp3nycmb7hu7abllqx23nfkm7tjgblgxsxq	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6sar222	bafyreih5bwjxfretqbmnmtnh2nmfoxrugkrsydmgo73izz26k64mxtxshy	2022-07-15T00:49:51.914Z	2024-06-07T12:43:11.725Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbears22	bafyreievpmbxokg5kzhvgjqjzlgx3pjgn5mhv2wyta4t4k6nd2aasijoxq	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xaw222	bafyreiaip7e3kif6rhhvkx4dckwbm3egog6sn7kkf4x5e2puj6d4lkit2m	2022-07-15T00:49:53.914Z	2024-06-07T12:43:11.769Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbi3tc22	bafyreih3hpi3al2jzpylkosfoeugbwnytdmvgnbjutu44qltv7mbitecj4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm73bt222	bafyreih3vtpmaliuufzvmvp2xh74kgwpnnam7axm3c24o6besdvqzg3bg4	2022-07-15T00:50:00.914Z	2024-06-07T12:43:11.893Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbkmv222	bafyreigkg4uyc27qgxcguhpvkey26h6nyri2dpifgetb6d3buamv7cnivq	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm74zic22	bafyreibom4ih33aggpyno5jlmjlaxjybicxr3wcotkmaf4xqila67dnhhu	2022-07-15T00:50:05.914Z	2024-06-07T12:43:11.976Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbmmec22	bafyreiek5nv7z3a35mvontvizqjjy7azdabuvenlsoweybc5wxgx7rpwim	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm75mzc22	bafyreihwcj7qlqtq4iwyi7vez4bf4akjqjpeysaxqcoyzvg5dgvuzofip4	2022-07-15T00:50:09.914Z	2024-06-07T12:43:12.041Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbnpjc22	bafyreif7szdvxfhehikrqw2ntnlsmigsjrfofzeovi4pzjaf2ss2wj7ggq	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm77cq222	bafyreifxrysbjhvhafppbgxwgg6tm6ye4iq56d6wft5ivjo6tyu7yke3be	2022-07-15T00:50:11.914Z	2024-06-07T12:43:12.079Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmboqps22	bafyreiamhuf5lstkinfwxd476b6523xpxnto6iujaeklqqukrg5foi6nzy	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7awic22	bafyreie5deuo4q3cbbfcms72ew3fhnpljyclzrqfc7ybathfcj54lyqu4e	2022-07-15T00:50:13.914Z	2024-06-07T12:43:12.111Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbqei222	bafyreifnhvf3q5vrsve4jf3ibfw2u4ga56nzf5g6uinht6bosudtdt3drm	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7dqdc22	bafyreig63wu7skovixex2waesavh2ifjmbxbgohfggaag35kkmovwh2u7u	2022-07-15T00:50:16.914Z	2024-06-07T12:43:12.164Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbrfok22	bafyreihzed2l3txajnevmpai5vol55pmgkdmz5msukfodpdfbusmy7heeq	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7gafs22	bafyreibw5y2w5tkkh3lwespoggcetavx2pmxnm6owicueqocrppxeftokq	2022-07-15T00:50:18.914Z	2024-06-07T12:43:12.201Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbrz7k22	bafyreidwyiihnh32y3l52x7thzonhoxjub5upzei3gzyvvkrajqlh2qdz4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7gvvc22	bafyreiglrva5gmt5mumpuj55c2wxbnknijfsztiz6n7imalmlv63a4bhk4	2022-07-15T00:50:19.914Z	2024-06-07T12:43:12.221Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbuzvc22	bafyreigwerbfwqa6i4cyelqoglubu3dpizt356zien253iqbw6j3ajqgh4	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7keak22	bafyreib5eet7fqeo3c7yujtnsvudsfcb44tmzxhcvxa6ogev2q6t5yfa5q	2022-07-15T00:50:25.914Z	2024-06-07T12:43:12.318Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbwaxc22	bafyreihbspp5xbc6ml5gfceyxtw45dep5wxvfeebqfeionivw4cij2lbea	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7mcqk22	bafyreibc6lqv5cla3g6xfubafiwapmfzvgbakgfwgcwcjkiwpaj4wyooqm	2022-07-15T00:50:27.914Z	2024-06-07T12:43:12.358Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbzdlk22	bafyreib3avs2qv6j44uxiubwqvt7h3v6b2mch5efukryvoumm4tycyq7tq	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7p2n222	bafyreigiqmzmew4cu6eeualqhurezkrtsunelk3hnzpc7ot3o23lhornvq	2022-07-15T00:50:33.914Z	2024-06-07T12:43:12.458Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbycf222	bafyreihf724omxuzdd4lxfn4ohoxvyjumhwt6iaxgumvq2czxujjl2tlzi	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7of5k22	bafyreibjpq4ipgtmol5ckai6544ipyqmvevvjakzc4x46ac3jhfyrm7gfy	2022-07-15T00:50:31.914Z	2024-06-07T12:43:12.424Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmcag5k22	bafyreid4j3voeon6nicjjzx3xkcohqlzajyumgupf7uuucid54mjoe5zyy	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7vjo222	bafyreif3qimkdrmai7smpokzs7u5tx6uuwvf22xta7rvijwtcxyi2rao64	2022-07-15T00:50:46.914Z	2024-06-07T12:43:12.691Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmcdtjk22	bafyreifiziaxzag2oggjdnxqfc7vdcxqi7dflysktlxavasgubf23is2gi	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma2qns22	bafyreidnyqv4p7iwm2tuoi7pfhkqpa3qwwwjsubu6tjxzwianersoc22qi	2022-07-15T00:50:52.914Z	2024-06-07T12:43:12.805Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcfm6222	bafyreifzduvnwhgwqlmic6m3gidpwmdvj7d3jqw2lygc2xtjncyquyauvm	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma4s3k22	bafyreih6ycrwvvvewm65opmzr2w2bgbfza4o674talhlcddpixp5mf6mv4	2022-07-15T00:50:55.914Z	2024-06-07T12:43:12.863Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmb45yk22	bafyreibo4dya4aa5vum2oktcrw3ehdi3dkgsmorp5kkqzahk2zuauyuk2a	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22	bafyreifsazs5bwjay324fnkz5ecluwy4bpehh5iwdkwmerj7ywhjj7pcnq	2022-07-15T00:49:40.914Z	2024-06-07T12:43:11.502Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmb5muk22	bafyreiepq3tvbikvzncv25vluhtvhy2qsw74v3ltxap3oozscyf6zwmpem	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6lgyc22	bafyreiarenp2r55zrv52fnig3wyttvdcluenvbu2m3oqte7qn4js54f5dq	2022-07-15T00:49:43.914Z	2024-06-07T12:43:11.550Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmb65hs22	bafyreibkl6rfkjkgtttdoncaciebbicobytcmovzuqxkuq5lez5of3lbb4	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6m2jc22	bafyreigfwyy5uw74g2gkfilquplidccubgxpvdihuvwjnkag2iogetp5fu	2022-07-15T00:49:44.914Z	2024-06-07T12:43:11.566Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbbzik22	bafyreigqdgpom4au2ojuw5ciyg3qv4ndq4cez76iwwnukwolwfxf2ysk2a	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6qxqk22	bafyreigytipb36mr5photttbnc7yrmy75tnwvcvohx3kg56vod5n522slq	2022-07-15T00:49:50.914Z	2024-06-07T12:43:11.702Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbftks22	bafyreib2f4wydqjqjajesllltoajse7ctcxs5um7l2d243wd3xeg4de7jq	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6zbek22	bafyreibs7cdwlfhlykogfpj5yimdk62ttoq5gn4akjk65zykistm4pk7cy	2022-07-15T00:49:56.914Z	2024-06-07T12:43:11.819Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbj33c22	bafyreicvalqrqqxszs4ltyijajs4lfsdboeyxq6psljrwmso3d3uoypu34	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm73ues22	bafyreigntykfl6qep45vt6wq46qrs7huq5opddpw5z2glomc24p2mdfjty	2022-07-15T00:50:02.914Z	2024-06-07T12:43:11.925Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbk5b222	bafyreiamlvybm2jnvkvivby2v7ynan6xipqxmmyags4ohqae2fbu52tx7i	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm74gwk22	bafyreibjfpn3ozc6rjzkjytahzatd77uarqqnnswivuvi2suhdycsmcflu	2022-07-15T00:50:04.914Z	2024-06-07T12:43:11.960Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbl5ic22	bafyreifr45svqe53muz7hu6ycgrkuwbcfbj2qqdu45ckiuy6yiiu26swju	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm74zic22	bafyreibom4ih33aggpyno5jlmjlaxjybicxr3wcotkmaf4xqila67dnhhu	2022-07-15T00:50:06.914Z	2024-06-07T12:43:11.992Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbwrkk22	bafyreidqjad7dl664tizb6ywszf4ic6p56tp3j2yyynboau6dzng7envf4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7mz7c22	bafyreid5ptmaadcgwqbehrtblhngprsk6dg2jwmc2j3zosfq7rdn57ztcy	2022-07-15T00:50:28.914Z	2024-06-07T12:43:12.374Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbytxk22	bafyreiexxhkswyhqohiwjwaubcqrbbyoqlmwfpo3n2dc6ogvt3cqxlhheu	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7of5k22	bafyreibjpq4ipgtmol5ckai6544ipyqmvevvjakzc4x46ac3jhfyrm7gfy	2022-07-15T00:50:32.914Z	2024-06-07T12:43:12.442Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmc43i222	bafyreidknw2bsnalk37yjux7t3jk6xmlji23x3m2muzkodl5pkpcsdwqjq	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7qz5222	bafyreihxtuaj4wfbyqjyswvscr5y7m7e7ojymxltfvrcyilg7z3yu5t7bi	2022-07-15T00:50:38.914Z	2024-06-07T12:43:12.550Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmc6uds22	bafyreiciixvr6gqhjit52roy6vutzmjhklhngq26degsj4fs62be7euhvy	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7uank22	bafyreigb5ssh4mbqyaylhacmzhnt6oiltbpirhmqazmtbpswbfbysflgn4	2022-07-15T00:50:43.914Z	2024-06-07T12:43:12.640Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcbhe222	bafyreihim7d3yj4rcddzmnnb2e24hobzjnnzmm5dbnaxnoivxkwbpep4fq	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7wtns22	bafyreihgh57cwdh3kywwadabvhnfpfrsvhmuugl5otz4xfsgsja7uhv2qm	2022-07-15T00:50:48.914Z	2024-06-07T12:43:12.726Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmcg7p222	bafyreifugmuoj4jabvu7ytmsii56znzg75ldyr7j6e4cdslarysugtvz7e	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkma5z5k22	bafyreidtr62xflznx7wov2vsnlzhrosvckdvf4wxcxelae6psf45js2g7m	2022-07-15T00:50:56.914Z	2024-06-07T12:43:12.881Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcjcdc22	bafyreiekh76fl7e4oaowdz7ogeszyy5d2f5lmc45bji6bcwimjdrgkirau	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmac3z222	bafyreiahz6chrakkw7en4ceothts6uyxlualmbsgaaaruneiouc4t4uqa4	2022-07-15T00:51:01.914Z	2024-06-07T12:43:12.983Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmckfic22	bafyreicpm3fs6yfggfoqbqwhjuomzxqgff3pe3zjewfsaz555rig5mibwm	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmadluc22	bafyreiccumm4iihqjafzdjj4lhtzwusrwnuefibe4nm3ja337y7zwoqmse	2022-07-15T00:51:03.914Z	2024-06-07T12:43:13.019Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmclinc22	bafyreigz7u6qagvocklhh7rlolj65yv3qzhluzxv2lliqk35fhyoj6joma	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmaexsk22	bafyreia25f2teavzep54pf5lpmj2c5cstertmc6uzsit6vt72k7bqlb4cm	2022-07-15T00:51:05.914Z	2024-06-07T12:43:13.053Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmcolbk22	bafyreihaab5tdspmlbelt2itx4m4hzuqvw4mx22i66fx54b2e4qbvvlc2e	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmajvz222	bafyreibcdzdfzu6gp6maiw2aopnyop6njhp4z7s4gtdy4paifyngjcfnze	2022-07-15T00:51:11.914Z	2024-06-07T12:43:13.157Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmcpogk22	bafyreibxtyht45ujg452yxvk7pjj2kkfflg2ywceymznnvmsu6s43psmni	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmalis222	bafyreiasu4pjf66p3od3o2mxzct6ivvz43tmghpanlhjnaotmk5hs4pq3y	2022-07-15T00:51:13.914Z	2024-06-07T12:43:13.192Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmcq7z222	bafyreie7hx7pjz6i32estrygavojubj7sptyrx4d2p6mkt5f534efm3doq	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmam7as22	bafyreidnh6h34yqwjgg65zdxkd35jms6vggpkc3abjojoy2bjcrmbb3f6i	2022-07-15T00:51:14.914Z	2024-06-07T12:43:13.211Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmb567s22	bafyreib63htruqay7izxfhugbujvr546fntcya2dc3zd2ph3qajejsr3fa	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6lgyc22	bafyreiarenp2r55zrv52fnig3wyttvdcluenvbu2m3oqte7qn4js54f5dq	2022-07-15T00:49:42.914Z	2024-06-07T12:43:11.534Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmb76oc22	bafyreidcnsfupzhs4jfqjgy3bjhwo7anrva4zfllwe2gm2l2qqlawssiey	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ndjs22	bafyreibbfl3v22jf4vneuwi3wy73d3t2xnqdc4cnb6dqhh4oxwqf6xuxsm	2022-07-15T00:49:46.914Z	2024-06-07T12:43:11.601Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbajnc22	bafyreihjdf4rjtedv2iunnkge6orfvhfxggymubyny3qiwq3l43q4xdxhi	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6pppc22	bafyreibd6kqdmg5bvqvfme3nu76crz5hpdygbuvtfo5z6gmn73pm23c4bi	2022-07-15T00:49:48.914Z	2024-06-07T12:43:11.651Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbdhfc22	bafyreifx5hffy7oszkdtz2k5fcw6h6vw74qdndylu473kjybmtrw2wrqpq	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6wiis22	bafyreigfuziopyoqcyv5jx6n7farmuxqmt6o3eeyszctl2xveyahtucnhe	2022-07-15T00:49:52.914Z	2024-06-07T12:43:11.751Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbetdk22	bafyreierhbxeyiomuyl2pntpfkme4linj37udscjgvfpzjyvspkmmow4ge	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xxes22	bafyreidqo3vj5ry5kvsm4srfutz27dtzkmqdzcq7sxouhcmxslcybcqf4m	2022-07-15T00:49:54.914Z	2024-06-07T12:43:11.787Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbfdws22	bafyreie6sxgclduizm4ra7eiylo3ktop3eclglekimm2oi2ep6jzgbgl5m	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6yoss22	bafyreifet3tq7lfikiwmcbp4puqxs5vl35otyg4skzvqdjjtq75juzazxq	2022-07-15T00:49:55.914Z	2024-06-07T12:43:11.803Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbgf5c22	bafyreicieje66isblikhgjer6wsila2sta7ocqln4ykubhv3ewojuxymae	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm72ncs22	bafyreifsu7lckdjbk6tunuxynocyxwfcwafnjsysnyjqtxpse53jj3eyru	2022-07-15T00:49:57.914Z	2024-06-07T12:43:11.841Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbjmns22	bafyreigvoziqloafdu3gpobmbrnjp4jnhjob7cxb5cfurhdod7ei3pvrgq	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm74gwk22	bafyreibjfpn3ozc6rjzkjytahzatd77uarqqnnswivuvi2suhdycsmcflu	2022-07-15T00:50:03.914Z	2024-06-07T12:43:11.943Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbn3yc22	bafyreibkxjdp5btj3ocntytbtafptri4aknszjfsjqrmwxmjpm25s66ima	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm76di222	bafyreict3zjalmndopvzm4rd5nzx2lz3spqnphfzifmoz7f3odke2jqptq	2022-07-15T00:50:10.914Z	2024-06-07T12:43:12.059Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbpbd222	bafyreib67mnowvk7y6wlntvuxtvt4mfseo55lrqmfw27lsew3pp2te5e4i	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7blxs22	bafyreigzrkdypcw6rzkdswhct6ay552cpzukzcfmrdxdhfi4tx2bfg3yaq	2022-07-15T00:50:14.914Z	2024-06-07T12:43:12.130Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbxtqc22	bafyreihwzexrvlhtoeuyvvpageidw6grcbeye4r7hv5f2h47gipl6a76ve	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7npo222	bafyreifktbxrueu6rfzzmsva4wn6cso23x4qrxcjqgrrk4f6upo4t6dd2m	2022-07-15T00:50:30.914Z	2024-06-07T12:43:12.409Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbzt7k22	bafyreih5oe3p2wvmax4sukn34j3jw3jds6u6jdujwgi2fa7fx4ycxiq5se	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7pn6s22	bafyreigvlrrozbjn3gxkcp44pspjbmtawgdxjw7qytnv2ts3rtqzgvpsqy	2022-07-15T00:50:34.914Z	2024-06-07T12:43:12.475Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmc2ug222	bafyreig7fe35orakwfc2t3zhfknjqo5tftp47ehx7puq6jvmombjnppt4e	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7qz5222	bafyreihxtuaj4wfbyqjyswvscr5y7m7e7ojymxltfvrcyilg7z3yu5t7bi	2022-07-15T00:50:36.914Z	2024-06-07T12:43:12.511Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmc56n222	bafyreihmavkyedlmpk3dybwwupuzgqx3pkaou6djlbcr42avxnr44ntgje	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7rkpk22	bafyreifl3toeqtvxgbdmp6ov6mcxxivj2entj66xn4x4kfvpp42m7gqr5q	2022-07-15T00:50:40.914Z	2024-06-07T12:43:12.586Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmc5q7k22	bafyreibk3c5minu5ybaermatnhg7rua4wywopjloddn2f7cqwloqyav36a	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7sxn222	bafyreihnw6l32rjmtkvt5s56doimw5lfu2ymwfqftnlc2euhdcmmnlqnz4	2022-07-15T00:50:41.914Z	2024-06-07T12:43:12.603Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmccqek22	bafyreibhfjtjo6el5sfekkfdam2umf2bpj7yqrlr3x4h4tht7klkchkn7y	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7zepk22	bafyreiavtz5pbqpzdwdns6cuk7tijrjueb7am77rdihyx3in5ytparccda	2022-07-15T00:50:50.914Z	2024-06-07T12:43:12.768Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmci4ak22	bafyreiag56ggmemivkgvmx7ev23bkpquj2lp47v2x7qn5gtq7clvao4zri	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmaa4js22	bafyreiad2yqm6qwrpshalzscz644qp3osayprmcddvhwo2dywiqffrm2bi	2022-07-15T00:50:59.914Z	2024-06-07T12:43:12.943Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmcmzhs22	bafyreic6qxlw5thajfh25gasly7g6g6u75bzijcswn75pet2cl3wz7lvbm	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmahcys22	bafyreiazaf56e45jmxntxyybs6hvwujxn4t23nf25oa76nzrn43jnlctoy	2022-07-15T00:51:08.914Z	2024-06-07T12:43:13.104Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmcrnvs22	bafyreibadnb666cxta3b3brvr74bpllyy6gxmcjsl4xk6tvnfuykhyme2i	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmao7pc22	bafyreiaagbmljfnqkwpppijmq2rc5ld25ohrvvcsyw2ilzbsvz5wqdh5l4	2022-07-15T00:51:16.914Z	2024-06-07T12:43:13.258Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcthjk22	bafyreibj6tu3zd2tqme5ivwublwrnwwb2sts5uriiv2riqzi7lyam7fqp4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmapbv222	bafyreihth3a7rf7n34zk5dfqnxbaijjey52lznc6sr6xwu7tap7lu65az4	2022-07-15T00:51:19.914Z	2024-06-07T12:43:13.315Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmb7qas22	bafyreicv5j6o4ykufpkoazq3hexj6gusojcok37mgvcrbmchpaqhilet4y	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ndjs22	bafyreibbfl3v22jf4vneuwi3wy73d3t2xnqdc4cnb6dqhh4oxwqf6xuxsm	2022-07-15T00:49:47.914Z	2024-06-07T12:43:11.627Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbba4222	bafyreiajjhrxsx5k3w2mko5rpkkkxj25mxfevrusu5xja47hbrxhgrr4cy	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6qcb222	bafyreideidtqpviy6deov3hiv2bph4ngud6snrf3rqj62e7n56me3accuy	2022-07-15T00:49:49.914Z	2024-06-07T12:43:11.676Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbgznk22	bafyreihe257r3gmtdugqo6rhcy3rkttclqq5zodrr27wl54bah7hadvpm4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm72ncs22	bafyreifsu7lckdjbk6tunuxynocyxwfcwafnjsysnyjqtxpse53jj3eyru	2022-07-15T00:49:58.914Z	2024-06-07T12:43:11.859Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbhla222	bafyreifsmcuz7vhe33xmxwxhjfdmi3ejt3yskiqoxoghysxm6f6upvhfiu	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm73bt222	bafyreih3vtpmaliuufzvmvp2xh74kgwpnnam7axm3c24o6besdvqzg3bg4	2022-07-15T00:49:59.914Z	2024-06-07T12:43:11.876Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbilhc22	bafyreidk5aescftg3msca2e5njfqkygob7wh32jx4ujn6qtrjmwunlnrlu	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm73ues22	bafyreigntykfl6qep45vt6wq46qrs7huq5opddpw5z2glomc24p2mdfjty	2022-07-15T00:50:01.914Z	2024-06-07T12:43:11.909Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbm2rs22	bafyreihz4t4xhrgrd5jumlfe5ippvtwxi7yyjjtarwo3mat4iqtx6p4pje	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm75mzc22	bafyreihwcj7qlqtq4iwyi7vez4bf4akjqjpeysaxqcoyzvg5dgvuzofip4	2022-07-15T00:50:08.914Z	2024-06-07T12:43:12.023Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbob3s22	bafyreibadqwgadjly75stbccw6zkgw5rjqut6x72zmijhkjuabspmezzpi	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7awic22	bafyreie5deuo4q3cbbfcms72ew3fhnpljyclzrqfc7ybathfcj54lyqu4e	2022-07-15T00:50:12.914Z	2024-06-07T12:43:12.095Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbqw2k22	bafyreicrgqiemo3pt7aiupib7af65oyhtg7fchkwzr3tl4espfljybvc5e	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7eetk22	bafyreicktcft44xal23bti6zihdlbldfrjii7r3zuro5djfbdmmrle5rem	2022-07-15T00:50:17.914Z	2024-06-07T12:43:12.182Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbsmqk22	bafyreigsjjhuwmm6nbup7uxrni5i5lxrsbaymhzprs2hquqrrtmz4tivcq	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7hles22	bafyreiat6kavehlet5nmwsgctjpeukavhtkalikajn54efgle2mmv2opzu	2022-07-15T00:50:20.914Z	2024-06-07T12:43:12.237Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbu3mk22	bafyreiahifws4jvb77spn5azueio26ujbfrfazyt6rggpeofcqsmalilfi	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7j2as22	bafyreih3yrxva7euqbsiozt473ou6giubfjq5dujecdoehkr7vuggkfxsu	2022-07-15T00:50:23.914Z	2024-06-07T12:43:12.286Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmcawqs22	bafyreifbq2kqyck55zdzl56etzoagrl3fxdscx23bfbqdubwusj5rye3mq	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7wa4s22	bafyreiajzithxxyp3pm5rzwxs4iz6ej4nfo7jj5y3uk77nxfd4o5hxjgza	2022-07-15T00:50:47.914Z	2024-06-07T12:43:12.708Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcdbx222	bafyreie6nm4mdx5hin3d3f5mhqt7icuvhxvrqw3pz2rapw6qwgv4al7esm	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma227222	bafyreiezftduzsjzbgjfyxkli3vbre3jybpgkilyvpfnhfoxfjthry3byy	2022-07-15T00:50:51.914Z	2024-06-07T12:43:12.786Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmcgrbk22	bafyreidzhif23rfvszfyfvmvaya343vimx5ipzg5zdzafa2u5afvsmlodq	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma6pmc22	bafyreicocopqz3vmrs7ndsx7l7rnph3sqpdoshml7f6vx4m2klvzkjpa24	2022-07-15T00:50:57.914Z	2024-06-07T12:43:12.902Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmcjuv222	bafyreigetbwhgwrdaoq5y2inazxf26gu7nxhhm3qop56d5e4trrsu6wz6i	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmadluc22	bafyreiccumm4iihqjafzdjj4lhtzwusrwnuefibe4nm3ja337y7zwoqmse	2022-07-15T00:51:02.914Z	2024-06-07T12:43:13.000Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmcmjts22	bafyreihwxolbkbesf4vqlrrqorl5qcl3p5ksgler4lpzr5w3wjs4u2dm4a	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmahcys22	bafyreiazaf56e45jmxntxyybs6hvwujxn4t23nf25oa76nzrn43jnlctoy	2022-07-15T00:51:07.914Z	2024-06-07T12:43:13.087Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcp5tc22	bafyreiefl4mx337teehxvlt5bmgsdjsbce5wtekzebh4hq4g3v7gz5vwga	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmajvz222	bafyreibcdzdfzu6gp6maiw2aopnyop6njhp4z7s4gtdy4paifyngjcfnze	2022-07-15T00:51:12.914Z	2024-06-07T12:43:13.173Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmcwafc22	bafyreickb46dva6cu6clpqj7hau7fyqlwkevdllhkwwjcxdif3c675opii	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmaqlus22	bafyreicoh73xyye3txq6ooqie3h5jv62zyt4mu362kvszxkxmczef6xu5u	2022-07-15T00:51:23.914Z	2024-06-07T12:43:13.410Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmblm5222	bafyreidnhyhlewf4m3y3qp7wr6ch5n35b6qkhbpi4ulexdh3hhvs6b7f7y	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm74zic22	bafyreibom4ih33aggpyno5jlmjlaxjybicxr3wcotkmaf4xqila67dnhhu	2022-07-15T00:50:07.914Z	2024-06-07T12:43:12.007Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbptus22	bafyreibqpnqgyfpogjtrp2btxi6nk66uhx2eccjxj7sj2ynwai5kk4ujca	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7czuk22	bafyreigjauenhx5xcfji4c6sw7ghv2nz2p2yz4alespogrf7r7l5nexazq	2022-07-15T00:50:15.914Z	2024-06-07T12:43:12.147Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbt3fc22	bafyreibqxdhqswe47yutv2dpr7fjdoip6jwaojzlmqqfn2hmejslffqfai	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7hles22	bafyreiat6kavehlet5nmwsgctjpeukavhtkalikajn54efgle2mmv2opzu	2022-07-15T00:50:21.914Z	2024-06-07T12:43:12.252Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbtkzc22	bafyreift365jgi7viqfc763n3gbm4e34lxxs3ce6gf3xnsqv6bx54hl4jm	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7ihp222	bafyreictq5xj4uggp3kaonouugalckasgzcvihlygzrbgnkz3npv3umhyu	2022-07-15T00:50:22.914Z	2024-06-07T12:43:12.269Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbulak22	bafyreibme6shvmktpnvg2js5xhzspyoll7xzvkktk73mfk2kqbo5stpsia	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7jpqc22	bafyreiarkx6bnx7jvqoqbq7aozirex5v2356rf2zztbuuwxxfnn7ibqoly	2022-07-15T00:50:24.914Z	2024-06-07T12:43:12.302Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbvlhs22	bafyreifdh7inlbj2o72uymphepw7fdx7lacvkdtqaougtkkrpu4gk7whle	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7lp7k22	bafyreibtftyjrbiemgppzwvro2sm3mqryfdya3wuuqw3q7vcfproc6z5a4	2022-07-15T00:50:26.914Z	2024-06-07T12:43:12.341Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbxc5s22	bafyreibn46friqbkwc7shjpvc3rorjeieg27bbeta5yr2bcpsqyavgx5cu	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7npo222	bafyreifktbxrueu6rfzzmsva4wn6cso23x4qrxcjqgrrk4f6upo4t6dd2m	2022-07-15T00:50:29.914Z	2024-06-07T12:43:12.392Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmc2ctk22	bafyreic6i6cmf5nde2y24wvosa5pc6ejg34gtrbfygc3wxlgvb6thqajl4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7qglc22	bafyreiduw3nbbzfjcxoa37imhi5qtdkjr2bkxgq6k4srpwpab6zpgcxlqm	2022-07-15T00:50:35.914Z	2024-06-07T12:43:12.492Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmc3gxs22	bafyreicwviq3o5iwjb4moug7pz6tabu7l5go7omhzc7vn2bm3xy2hsgdbe	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7qz5222	bafyreihxtuaj4wfbyqjyswvscr5y7m7e7ojymxltfvrcyilg7z3yu5t7bi	2022-07-15T00:50:37.914Z	2024-06-07T12:43:12.531Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmc4n2k22	bafyreia52blveq3vlhgiezg45oodf63dfkrnyb7gepiesg7iacu3x7q5xy	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7rkpk22	bafyreifl3toeqtvxgbdmp6ov6mcxxivj2entj66xn4x4kfvpp42m7gqr5q	2022-07-15T00:50:39.914Z	2024-06-07T12:43:12.567Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmc6ass22	bafyreib7f375jwr3f72fulckpaxpr4mlqqf4qbi3b622swtzbbkvevqokq	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7tm5c22	bafyreidvpfwzrp7zlftziynbgybw2d5vh36yirkrtvwollweu7o2i4l4ki	2022-07-15T00:50:42.914Z	2024-06-07T12:43:12.621Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmc7ex222	bafyreidtg5k6iocbzhoa5p3w4ibtk6minxq2z2ykyxfgdpreueiiuk77te	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7uank22	bafyreigb5ssh4mbqyaylhacmzhnt6oiltbpirhmqazmtbpswbfbysflgn4	2022-07-15T00:50:44.914Z	2024-06-07T12:43:12.658Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmc7vkc22	bafyreifcyxjw2dee4skfn7yanpjynxwhvgge5dlqvernklzqkfj57v7seq	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7uw5222	bafyreieouj26ubtzwd43olrtigwuhdlj4e555waytjfp65lp4wahvh6eva	2022-07-15T00:50:45.914Z	2024-06-07T12:43:12.674Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcc5ss22	bafyreihhgmrglznmlqlelmbyzyg2rhpshycvzpzcwuz734mo4iwub3i3te	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7ymcc22	bafyreicdlrtocb5hivmgg5vfcas2bypsrk64dehthoqhjmkvl64o6kpgqy	2022-07-15T00:50:49.914Z	2024-06-07T12:43:12.749Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmceyn222	bafyreia5tjs3tzp2ewp6oklqbck2w3dqet7rioc65iw6i5zdumjf2y6pqq	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma4s3k22	bafyreih6ycrwvvvewm65opmzr2w2bgbfza4o674talhlcddpixp5mf6mv4	2022-07-15T00:50:54.914Z	2024-06-07T12:43:12.843Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmceh2k22	bafyreigdubfzfex653l4at2a6akexq5wvevbsf3zoec5cy3sd6c6mnfp3u	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma46kk22	bafyreicgt73gbvybblwvgog63c73uoyvzkiwpflu2zi2dbywpnafz3r7mi	2022-07-15T00:50:53.914Z	2024-06-07T12:43:12.824Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmciqqs22	bafyreiasc3psbegk4vyhqe3hhu666g7idf6nwbcjcd7pecpc7ksp5qngym	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmab2sk22	bafyreifwkhtulxci2yl7bbiq5u4gs2d34ldi5o73svdvakfknp4g73ula4	2022-07-15T00:51:00.914Z	2024-06-07T12:43:12.965Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmcky2222	bafyreievivw2ofagwdezktauh4yhktwk4n3edlw4iw46i2i2b5imww4nia	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmaeaek22	bafyreihkzh7ny5yrxqemvybg3i7777fj7mfnde6xeyrt4wmxjs5rljgoge	2022-07-15T00:51:04.914Z	2024-06-07T12:43:13.036Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmco2oc22	bafyreihmh54k737wxexqbx54b7ayagnbltl46zv5t4z762kn6y4mrp3lyi	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmaig5s22	bafyreihjk3euvxnwb34irk5rszmtai57cv5zayb6tdffswiljtylv6xu6y	2022-07-15T00:51:10.914Z	2024-06-07T12:43:13.138Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcvixc22	bafyreicnb2dwv2ks3hxqen6e4oa3sldre7ajeikdzzzf7t7zjeadkukhla	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmaqlus22	bafyreicoh73xyye3txq6ooqie3h5jv62zyt4mu362kvszxkxmczef6xu5u	2022-07-15T00:51:22.914Z	2024-06-07T12:43:13.387Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmchipk22	bafyreidxda7p6snwpxwiwpkxe6hot3hhb7utw2z6wlzdxxdqm7kdj4jwvm	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma7h2c22	bafyreidrqkwmhh2yxhpkbisqufrib2mysgrztuof6s2ur6p7362n5ozk4q	2022-07-15T00:50:58.914Z	2024-06-07T12:43:12.925Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcm27s22	bafyreiggccdefhr4abfliletitdnhlrznz2abpfrcd2mufofa44k7u2e7u	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmagjmc22	bafyreiapglbozxgvrngr3i56brbaukc5udsdbwsmmp7axguqscbtavuz6m	2022-07-15T00:51:06.914Z	2024-06-07T12:43:13.071Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcnk3222	bafyreiejzhawlvggqqhqe2wkinlgjzx5zeqmvumhj5mfbcf67wy74ylk2a	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmaig5s22	bafyreihjk3euvxnwb34irk5rszmtai57cv5zayb6tdffswiljtylv6xu6y	2022-07-15T00:51:09.914Z	2024-06-07T12:43:13.120Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmcqvik22	bafyreibzdjrsmepzmiyaqmsszv3pyyddpy5nnuvujoyieyykwpvsfi2ysa	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmamvpk22	bafyreigzm756fmbrj22rhawr7cojojnc7g3bu32rzjw6armvhpfjvvkgz4	2022-07-15T00:51:15.914Z	2024-06-07T12:43:13.238Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmcsuxs22	bafyreigkub5eq2m232en4m7w5s55lmpnvlrmdqwq23w44u5ukvcgmemf3m	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmapbv222	bafyreihth3a7rf7n34zk5dfqnxbaijjey52lznc6sr6xwu7tap7lu65az4	2022-07-15T00:51:18.914Z	2024-06-07T12:43:13.298Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcu32k22	bafyreigage754fwqjpknehxb25gmqrs6h7detvpyqvpayo22o5bvsngswm	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmapzd222	bafyreid3xstgek64pqr2zq6bohxi4vkfqmyr7e4wjsprguho5av3oz4ec4	2022-07-15T00:51:20.914Z	2024-06-07T12:43:13.338Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmcsdfc22	bafyreic757whyqhknlbaoxt3w5wazhhxzcrww72cegiohrtlfwk75u2fcy	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmao7pc22	bafyreiaagbmljfnqkwpppijmq2rc5ld25ohrvvcsyw2ilzbsvz5wqdh5l4	2022-07-15T00:51:17.914Z	2024-06-07T12:43:13.278Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmcuqk222	bafyreifihrxd4xyvengrdyza22emnpwv5fcy7lzyfe5ahsb6tnvzyj4t34	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmapzd222	bafyreid3xstgek64pqr2zq6bohxi4vkfqmyr7e4wjsprguho5av3oz4ec4	2022-07-15T00:51:21.914Z	2024-06-07T12:43:13.362Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmczvlc22	bafyreihpqekop6rp4kktj2tsxalz5lm6k3qiee4syzhxh5vyigc2rmby4i	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.generator/alice-favs	bafyreidysakacrh2omr5ht5zb4xw2w46m7ngjitvefjzjzkt6qo6xjowfq	2022-07-15T00:51:27.914Z	2024-06-07T12:43:13.526Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmd2g6k22	bafyreifjcbyw2ygsq7v6ba2kgrgzkc4725lrytrbupd6p7ocfulxj3yetq	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.generator/alice-favs	bafyreidysakacrh2omr5ht5zb4xw2w46m7ngjitvefjzjzkt6qo6xjowfq	2022-07-15T00:51:28.914Z	2024-06-07T12:43:13.543Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmczc2c22	bafyreidzh34ranysjm5odt5fhihivmhoxvmwpk3euoad4k6mzpaqhwvpie	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.generator/alice-favs	bafyreidysakacrh2omr5ht5zb4xw2w46m7ngjitvefjzjzkt6qo6xjowfq	2022-07-15T00:51:26.914Z	2024-06-07T12:43:13.507Z
\.


--
-- Data for Name: list; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.list (uri, cid, creator, name, purpose, description, "descriptionFacets", "avatarCid", "createdAt", "indexedAt") FROM stdin;
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.graph.list/3kudkmda6qs22	bafyreibox4vqiy3aqwc45buq67o63dmwpxq65uxifve5hy7mvey7tevdge	did:plc:zluht54hsscg6octtayzd3ft	Flower Lovers	app.bsky.graph.defs#curatelist	A list of posts about flowers	\N	\N	2024-06-07T12:43:13.718Z	2024-06-07T12:43:13.732Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.graph.list/3kudkmdaz4k22	bafyreidy2za7t56ljmcknvq2xh5bgrylg64mnkegcrck663i25hu6qyniq	did:plc:5ssevsxo3qyovxpgkg3n2tfs	Label Haters	app.bsky.graph.defs#modlist	A list of people who hate labels	\N	\N	2024-06-07T12:43:13.742Z	2024-06-07T12:43:13.781Z
\.


--
-- Data for Name: list_block; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.list_block (uri, cid, creator, "subjectUri", "createdAt", "indexedAt") FROM stdin;
\.


--
-- Data for Name: list_item; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.list_item (uri, cid, creator, "subjectDid", "listUri", "createdAt", "indexedAt") FROM stdin;
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.graph.listitem/3kudkmdcgzc22	bafyreifx6cbttppistnsvq6ma3754sfwqygpxb3ctgp7nzvymytuwyq5qi	did:plc:zluht54hsscg6octtayzd3ft	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.graph.list/3kudkmda6qs22	2024-06-07T12:43:13.789Z	2024-06-07T12:43:13.807Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.graph.listitem/3kudkmdczl222	bafyreieuieeyqn7ukyou4ofrhhqc7ywljfzv7slhfqonfmphkyf7q5hyui	did:plc:5ssevsxo3qyovxpgkg3n2tfs	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.graph.list/3kudkmdaz4k22	2024-06-07T12:43:13.809Z	2024-06-07T12:43:13.825Z
\.


--
-- Data for Name: list_mute; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.list_mute ("listUri", "mutedByDid", "createdAt") FROM stdin;
\.


--
-- Data for Name: moderation_action; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.moderation_action (id, action, "subjectType", "subjectDid", "subjectUri", "subjectCid", reason, "createdAt", "createdBy", "reversedAt", "reversedBy", "reversedReason", "createLabelVals", "negateLabelVals", "durationInHours", "expiresAt") FROM stdin;
\.


--
-- Data for Name: moderation_action_subject_blob; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.moderation_action_subject_blob ("actionId", cid) FROM stdin;
\.


--
-- Data for Name: moderation_event; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.moderation_event (id, action, "subjectType", "subjectDid", "subjectUri", "subjectCid", comment, meta, "createdAt", "createdBy", "reversedAt", "reversedBy", "durationInHours", "expiresAt", "reversedReason", "createLabelVals", "negateLabelVals", "legacyRefId") FROM stdin;
\.


--
-- Data for Name: moderation_report; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.moderation_report (id, "subjectType", "subjectDid", "subjectUri", "subjectCid", "reasonType", reason, "reportedByDid", "createdAt") FROM stdin;
\.


--
-- Data for Name: moderation_report_resolution; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.moderation_report_resolution ("reportId", "actionId", "createdBy", "createdAt") FROM stdin;
\.


--
-- Data for Name: moderation_subject_status; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.moderation_subject_status (id, did, "recordPath", "blobCids", "recordCid", "reviewState", comment, "muteUntil", "lastReviewedAt", "lastReviewedBy", "lastReportedAt", takendown, "suspendUntil", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: mute; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.mute ("subjectDid", "mutedByDid", "createdAt") FROM stdin;
\.


--
-- Data for Name: notification; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.notification (id, did, "recordUri", "recordCid", author, reason, "reasonSubject", "sortAt") FROM stdin;
1	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.graph.follow/3kudkm5uimc22	bafyreiexnx6mlny6ejitqpq6pmgzmmudlwnjv4leiyzseqi2ftlsyhr5xe	did:plc:zluht54hsscg6octtayzd3ft	follow	\N	2022-07-15T00:47:11.914Z
2	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.graph.follow/3kudkm5vhuc22	bafyreifj5ej3fcuh573kjf4u7p6r35erckbijdu72wxrq5rnfb7uof7yyu	did:plc:5ssevsxo3qyovxpgkg3n2tfs	follow	\N	2022-07-15T00:47:13.914Z
3	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.graph.follow/3kudkm5wkzc22	bafyreienbm2q5mu7n4dogfc5orrzwdcqk2wdfzgmtbzs4xxc5vvy43gu4q	did:plc:awpz77o4dyluwpa2j2p2oqgs	follow	\N	2022-07-15T00:47:15.914Z
4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.graph.follow/3kudkm5x5l222	bafyreidjrfcbto7z7owmtpeyvs7lifd6ljwtocx5mmbajdfonlk6mv5hyu	did:plc:awpz77o4dyluwpa2j2p2oqgs	follow	\N	2022-07-15T00:47:16.914Z
5	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.graph.follow/3kudkm5uxb222	bafyreigbxvp7wtwgo26ljetfqsngijk2e2ko744i4uyy36xgs7hh624u7y	did:plc:zluht54hsscg6octtayzd3ft	follow	\N	2022-07-15T00:47:12.914Z
6	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.graph.follow/3kudkm5vzgs22	bafyreie7m5mbj46oiwd56pvlhsvszlhkqtrst65ssn3hfncjv3g5zfylm4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	follow	\N	2022-07-15T00:47:14.914Z
7	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.repost/3kudkm6e6ks22	bafyreihkqndhv2u3jpzos2uiugmuylwfe33x6zmqnq4x47y2hf7d4cmuoe	did:plc:awpz77o4dyluwpa2j2p2oqgs	repost	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm5zpm222	2022-07-15T00:47:34.914Z
8	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6lgyc22	bafyreiarenp2r55zrv52fnig3wyttvdcluenvbu2m3oqte7qn4js54f5dq	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	2022-07-15T00:47:39.914Z
9	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6m2jc22	bafyreigfwyy5uw74g2gkfilquplidccubgxpvdihuvwjnkag2iogetp5fu	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm63k7222	2022-07-15T00:47:40.914Z
10	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22	bafyreicyq7eldus5jwjulcgmbijfzkiqyfbnoo74fmowj5n2ydxqc4q7he	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	2022-07-15T00:47:41.914Z
11	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ndjs22	bafyreibbfl3v22jf4vneuwi3wy73d3t2xnqdc4cnb6dqhh4oxwqf6xuxsm	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22	2022-07-15T00:47:42.914Z
12	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6pppc22	bafyreibd6kqdmg5bvqvfme3nu76crz5hpdygbuvtfo5z6gmn73pm23c4bi	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	2022-07-15T00:47:46.914Z
13	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6qcb222	bafyreideidtqpviy6deov3hiv2bph4ngud6snrf3rqj62e7n56me3accuy	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22	2022-07-15T00:47:47.914Z
14	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6oho222	bafyreidztf4duw63m5xb6uisugocsmehokjp6sb7jyjqwxmu65pyt34s7m	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	2022-07-15T00:47:44.914Z
15	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6rna222	bafyreifuxoreut7uuibyzm5wmrl2wefsc4e3ksoeunj4k5fmntrciairi4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22	2022-07-15T00:47:49.914Z
16	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6p55k22	bafyreid2w2wi55ko3m3lcj6puvrywdcfey2dapgg2raddqvcjq5jxkw6be	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22	2022-07-15T00:47:45.914Z
17	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6qxqk22	bafyreigytipb36mr5photttbnc7yrmy75tnwvcvohx3kg56vod5n522slq	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	2022-07-15T00:47:48.914Z
18	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6vszc22	bafyreifgmn2zhq5qstdcc77yedzggkow3gz67c6daubgntpqi7uktqkpam	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64eks22	2022-07-15T00:47:55.914Z
19	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6twhs22	bafyreiazf5m4p3ly542yppowxjctwxq6bo7wqn3vxhwlw4zf6gafagjdmi	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22	2022-07-15T00:47:52.914Z
20	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6wiis22	bafyreigfuziopyoqcyv5jx6n7farmuxqmt6o3eeyszctl2xveyahtucnhe	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22	2022-07-15T00:47:56.914Z
21	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xaw222	bafyreiaip7e3kif6rhhvkx4dckwbm3egog6sn7kkf4x5e2puj6d4lkit2m	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6twhs22	2022-07-15T00:47:57.914Z
22	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xaw222	bafyreiaip7e3kif6rhhvkx4dckwbm3egog6sn7kkf4x5e2puj6d4lkit2m	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22	2022-07-15T00:47:57.914Z
23	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6uky222	bafyreidokrfnhzk5mnwcicnvw7cuorg2qgnpotk2vicwcuhxeua2cxwur4	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6pppc22	2022-07-15T00:47:53.914Z
24	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6uky222	bafyreidokrfnhzk5mnwcicnvw7cuorg2qgnpotk2vicwcuhxeua2cxwur4	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	2022-07-15T00:47:53.914Z
25	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xxes22	bafyreidqo3vj5ry5kvsm4srfutz27dtzkmqdzcq7sxouhcmxslcybcqf4m	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22	2022-07-15T00:47:58.914Z
26	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6zbek22	bafyreibs7cdwlfhlykogfpj5yimdk62ttoq5gn4akjk65zykistm4pk7cy	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22	2022-07-15T00:48:00.914Z
34	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm74gwk22	bafyreibjfpn3ozc6rjzkjytahzatd77uarqqnnswivuvi2suhdycsmcflu	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6wiis22	2022-07-15T00:48:05.914Z
48	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7gvvc22	bafyreiglrva5gmt5mumpuj55c2wxbnknijfsztiz6n7imalmlv63a4bhk4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xaw222	2022-07-15T00:48:20.914Z
49	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7gvvc22	bafyreiglrva5gmt5mumpuj55c2wxbnknijfsztiz6n7imalmlv63a4bhk4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6twhs22	2022-07-15T00:48:20.914Z
53	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7ihp222	bafyreictq5xj4uggp3kaonouugalckasgzcvihlygzrbgnkz3npv3umhyu	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm74zic22	2022-07-15T00:48:22.914Z
54	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7ihp222	bafyreictq5xj4uggp3kaonouugalckasgzcvihlygzrbgnkz3npv3umhyu	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22	2022-07-15T00:48:22.914Z
57	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7keak22	bafyreib5eet7fqeo3c7yujtnsvudsfcb44tmzxhcvxa6ogev2q6t5yfa5q	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22	2022-07-15T00:48:25.914Z
61	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7npo222	bafyreifktbxrueu6rfzzmsva4wn6cso23x4qrxcjqgrrk4f6upo4t6dd2m	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xaw222	2022-07-15T00:48:30.914Z
62	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7npo222	bafyreifktbxrueu6rfzzmsva4wn6cso23x4qrxcjqgrrk4f6upo4t6dd2m	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6twhs22	2022-07-15T00:48:30.914Z
64	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7p2n222	bafyreigiqmzmew4cu6eeualqhurezkrtsunelk3hnzpc7ot3o23lhornvq	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6zuvk22	2022-07-15T00:48:32.914Z
68	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7rkpk22	bafyreifl3toeqtvxgbdmp6ov6mcxxivj2entj66xn4x4kfvpp42m7gqr5q	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7cbhc22	2022-07-15T00:48:36.914Z
100	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmadluc22	bafyreiccumm4iihqjafzdjj4lhtzwusrwnuefibe4nm3ja337y7zwoqmse	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmaa4js22	2022-07-15T00:49:01.914Z
101	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmadluc22	bafyreiccumm4iihqjafzdjj4lhtzwusrwnuefibe4nm3ja337y7zwoqmse	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22	2022-07-15T00:49:01.914Z
117	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmanm6c22	bafyreihvzfls3zk4ev6s5p3r6ax3e3rrkhw5njjjb3yggnspydxhvhu7aa	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma6pmc22	2022-07-15T00:49:14.914Z
119	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmanm6c22	bafyreihvzfls3zk4ev6s5p3r6ax3e3rrkhw5njjjb3yggnspydxhvhu7aa	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7mcqk22	2022-07-15T00:49:14.914Z
120	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmapbv222	bafyreihth3a7rf7n34zk5dfqnxbaijjey52lznc6sr6xwu7tap7lu65az4	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6v7ic22	2022-07-15T00:49:16.914Z
123	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmaqlus22	bafyreicoh73xyye3txq6ooqie3h5jv62zyt4mu362kvszxkxmczef6xu5u	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm66hx222	2022-07-15T00:49:18.914Z
125	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmatsg222	bafyreicsjstocs4sqjdobzetcacji4eawzizngrnuvdzsy5vdjvlyri4hm	did:plc:zluht54hsscg6octtayzd3ft	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22	2022-07-15T00:49:24.914Z
153	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmblm5222	bafyreidnhyhlewf4m3y3qp7wr6ch5n35b6qkhbpi4ulexdh3hhvs6b7f7y	did:plc:awpz77o4dyluwpa2j2p2oqgs	like	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm74zic22	2022-07-15T00:50:07.914Z
157	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbptus22	bafyreibqpnqgyfpogjtrp2btxi6nk66uhx2eccjxj7sj2ynwai5kk4ujca	did:plc:awpz77o4dyluwpa2j2p2oqgs	like	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7czuk22	2022-07-15T00:50:15.914Z
163	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbulak22	bafyreibme6shvmktpnvg2js5xhzspyoll7xzvkktk73mfk2kqbo5stpsia	did:plc:awpz77o4dyluwpa2j2p2oqgs	like	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7jpqc22	2022-07-15T00:50:24.914Z
167	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbxc5s22	bafyreibn46friqbkwc7shjpvc3rorjeieg27bbeta5yr2bcpsqyavgx5cu	did:plc:zluht54hsscg6octtayzd3ft	like	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7npo222	2022-07-15T00:50:29.914Z
171	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmc4n2k22	bafyreia52blveq3vlhgiezg45oodf63dfkrnyb7gepiesg7iacu3x7q5xy	did:plc:5ssevsxo3qyovxpgkg3n2tfs	like	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7rkpk22	2022-07-15T00:50:39.914Z
173	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmc6ass22	bafyreib7f375jwr3f72fulckpaxpr4mlqqf4qbi3b622swtzbbkvevqokq	did:plc:zluht54hsscg6octtayzd3ft	like	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7tm5c22	2022-07-15T00:50:42.914Z
27	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6zuvk22	bafyreihjmjhi6ovt77ffrwdttf4m2xmfi6ug5wczn2xccetuw2nj2racd4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22	2022-07-15T00:48:01.914Z
32	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm75mzc22	bafyreihwcj7qlqtq4iwyi7vez4bf4akjqjpeysaxqcoyzvg5dgvuzofip4	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	2022-07-15T00:48:07.914Z
39	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7blxs22	bafyreigzrkdypcw6rzkdswhct6ay552cpzukzcfmrdxdhfi4tx2bfg3yaq	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6vszc22	2022-07-15T00:48:12.914Z
42	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7blxs22	bafyreigzrkdypcw6rzkdswhct6ay552cpzukzcfmrdxdhfi4tx2bfg3yaq	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64eks22	2022-07-15T00:48:12.914Z
56	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7j2as22	bafyreih3yrxva7euqbsiozt473ou6giubfjq5dujecdoehkr7vuggkfxsu	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64eks22	2022-07-15T00:48:23.914Z
59	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7mcqk22	bafyreibc6lqv5cla3g6xfubafiwapmfzvgbakgfwgcwcjkiwpaj4wyooqm	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22	2022-07-15T00:48:28.914Z
63	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7of5k22	bafyreibjpq4ipgtmol5ckai6544ipyqmvevvjakzc4x46ac3jhfyrm7gfy	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6qcb222	2022-07-15T00:48:31.914Z
66	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7qglc22	bafyreiduw3nbbzfjcxoa37imhi5qtdkjr2bkxgq6k4srpwpab6zpgcxlqm	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6uky222	2022-07-15T00:48:34.914Z
67	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7qglc22	bafyreiduw3nbbzfjcxoa37imhi5qtdkjr2bkxgq6k4srpwpab6zpgcxlqm	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	2022-07-15T00:48:34.914Z
75	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7uank22	bafyreigb5ssh4mbqyaylhacmzhnt6oiltbpirhmqazmtbpswbfbysflgn4	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6zbek22	2022-07-15T00:48:40.914Z
77	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7vjo222	bafyreif3qimkdrmai7smpokzs7u5tx6uuwvf22xta7rvijwtcxyi2rao64	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm63k7222	2022-07-15T00:48:42.914Z
79	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7wa4s22	bafyreiajzithxxyp3pm5rzwxs4iz6ej4nfo7jj5y3uk77nxfd4o5hxjgza	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6v7ic22	2022-07-15T00:48:43.914Z
80	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7wa4s22	bafyreiajzithxxyp3pm5rzwxs4iz6ej4nfo7jj5y3uk77nxfd4o5hxjgza	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	2022-07-15T00:48:43.914Z
82	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7ymcc22	bafyreicdlrtocb5hivmgg5vfcas2bypsrk64dehthoqhjmkvl64o6kpgqy	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6t62k22	2022-07-15T00:48:46.914Z
90	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkma5z5k22	bafyreidtr62xflznx7wov2vsnlzhrosvckdvf4wxcxelae6psf45js2g7m	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7dqdc22	2022-07-15T00:48:54.914Z
91	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkma5z5k22	bafyreidtr62xflznx7wov2vsnlzhrosvckdvf4wxcxelae6psf45js2g7m	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6twhs22	2022-07-15T00:48:54.914Z
95	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma4s3k22	bafyreih6ycrwvvvewm65opmzr2w2bgbfza4o674talhlcddpixp5mf6mv4	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22	2022-07-15T00:48:52.914Z
109	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmaig5s22	bafyreihjk3euvxnwb34irk5rszmtai57cv5zayb6tdffswiljtylv6xu6y	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22	2022-07-15T00:49:07.914Z
111	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmajvz222	bafyreibcdzdfzu6gp6maiw2aopnyop6njhp4z7s4gtdy4paifyngjcfnze	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm5zpm222	2022-07-15T00:49:09.914Z
28	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6yoss22	bafyreifet3tq7lfikiwmcbp4puqxs5vl35otyg4skzvqdjjtq75juzazxq	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22	2022-07-15T00:47:59.914Z
30	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm74zic22	bafyreibom4ih33aggpyno5jlmjlaxjybicxr3wcotkmaf4xqila67dnhhu	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm73bt222	2022-07-15T00:48:06.914Z
31	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm74zic22	bafyreibom4ih33aggpyno5jlmjlaxjybicxr3wcotkmaf4xqila67dnhhu	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22	2022-07-15T00:48:06.914Z
36	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7awic22	bafyreie5deuo4q3cbbfcms72ew3fhnpljyclzrqfc7ybathfcj54lyqu4e	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm66hx222	2022-07-15T00:48:11.914Z
44	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7czuk22	bafyreigjauenhx5xcfji4c6sw7ghv2nz2p2yz4alespogrf7r7l5nexazq	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6v7ic22	2022-07-15T00:48:14.914Z
45	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7czuk22	bafyreigjauenhx5xcfji4c6sw7ghv2nz2p2yz4alespogrf7r7l5nexazq	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	2022-07-15T00:48:14.914Z
52	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7gafs22	bafyreibw5y2w5tkkh3lwespoggcetavx2pmxnm6owicueqocrppxeftokq	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	2022-07-15T00:48:19.914Z
60	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7mz7c22	bafyreid5ptmaadcgwqbehrtblhngprsk6dg2jwmc2j3zosfq7rdn57ztcy	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	2022-07-15T00:48:29.914Z
83	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma227222	bafyreiezftduzsjzbgjfyxkli3vbre3jybpgkilyvpfnhfoxfjthry3byy	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6bhnk22	2022-07-15T00:48:48.914Z
86	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma2qns22	bafyreidnyqv4p7iwm2tuoi7pfhkqpa3qwwwjsubu6tjxzwianersoc22qi	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6pppc22	2022-07-15T00:48:49.914Z
87	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma2qns22	bafyreidnyqv4p7iwm2tuoi7pfhkqpa3qwwwjsubu6tjxzwianersoc22qi	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	2022-07-15T00:48:49.914Z
97	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmab2sk22	bafyreifwkhtulxci2yl7bbiq5u4gs2d34ldi5o73svdvakfknp4g73ula4	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7rkpk22	2022-07-15T00:48:58.914Z
102	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmacugc22	bafyreigxi6u33zlzunwuosrs73xgn6335oi7p3c4ulzqfedyoqffkt6li4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6m2jc22	2022-07-15T00:49:00.914Z
112	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmakqes22	bafyreieqb5mec6ke3bstogsks46ka4hvgop7skmyvwasgigwsb4l4wm6ji	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma2qns22	2022-07-15T00:49:10.914Z
113	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmakqes22	bafyreieqb5mec6ke3bstogsks46ka4hvgop7skmyvwasgigwsb4l4wm6ji	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	2022-07-15T00:49:10.914Z
114	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmalis222	bafyreiasu4pjf66p3od3o2mxzct6ivvz43tmghpanlhjnaotmk5hs4pq3y	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	2022-07-15T00:49:11.914Z
121	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmapzd222	bafyreid3xstgek64pqr2zq6bohxi4vkfqmyr7e4wjsprguho5av3oz4ec4	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma4s3k22	2022-07-15T00:49:17.914Z
124	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmas7n222	bafyreih62t2lumuzt33dvegh4s2crnblumru5gllko4rfphn25lbo4s7ja	did:plc:awpz77o4dyluwpa2j2p2oqgs	like	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	2022-07-15T00:49:21.914Z
127	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmauro222	bafyreieofchcqoyt5go7hu2fhuprgcvltgoiqawrsbl5eprxs7o7xg6sbq	did:plc:zluht54hsscg6octtayzd3ft	like	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64eks22	2022-07-15T00:49:26.914Z
133	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmb33ss22	bafyreicsma5f6scg2tqsq5z3geinqacadaqm7xfnlrrbzuhzxatuwgrcja	did:plc:awpz77o4dyluwpa2j2p2oqgs	like	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22	2022-07-15T00:49:38.914Z
134	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmb45yk22	bafyreibo4dya4aa5vum2oktcrw3ehdi3dkgsmorp5kkqzahk2zuauyuk2a	did:plc:5ssevsxo3qyovxpgkg3n2tfs	like	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22	2022-07-15T00:49:40.914Z
136	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmb5muk22	bafyreiepq3tvbikvzncv25vluhtvhy2qsw74v3ltxap3oozscyf6zwmpem	did:plc:awpz77o4dyluwpa2j2p2oqgs	like	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6lgyc22	2022-07-15T00:49:43.914Z
137	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmb65hs22	bafyreibkl6rfkjkgtttdoncaciebbicobytcmovzuqxkuq5lez5of3lbb4	did:plc:awpz77o4dyluwpa2j2p2oqgs	like	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6m2jc22	2022-07-15T00:49:44.914Z
142	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbbzik22	bafyreigqdgpom4au2ojuw5ciyg3qv4ndq4cez76iwwnukwolwfxf2ysk2a	did:plc:awpz77o4dyluwpa2j2p2oqgs	like	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6qxqk22	2022-07-15T00:49:50.914Z
29	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm73bt222	bafyreih3vtpmaliuufzvmvp2xh74kgwpnnam7axm3c24o6besdvqzg3bg4	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22	2022-07-15T00:48:03.914Z
33	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm73ues22	bafyreigntykfl6qep45vt6wq46qrs7huq5opddpw5z2glomc24p2mdfjty	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22	2022-07-15T00:48:04.914Z
43	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7eetk22	bafyreicktcft44xal23bti6zihdlbldfrjii7r3zuro5djfbdmmrle5rem	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22	2022-07-15T00:48:16.914Z
74	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7tm5c22	bafyreidvpfwzrp7zlftziynbgybw2d5vh36yirkrtvwollweu7o2i4l4ki	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22	2022-07-15T00:48:39.914Z
78	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7wtns22	bafyreihgh57cwdh3kywwadabvhnfpfrsvhmuugl5otz4xfsgsja7uhv2qm	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6zuvk22	2022-07-15T00:48:44.914Z
88	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma3k2c22	bafyreiaw2qpwzp6x6jlx5rzzknelrsajqi2titcwmji625na6xcglyiv4q	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6t62k22	2022-07-15T00:48:50.914Z
94	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma6pmc22	bafyreicocopqz3vmrs7ndsx7l7rnph3sqpdoshml7f6vx4m2klvzkjpa24	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7mcqk22	2022-07-15T00:48:55.914Z
99	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmaa4js22	bafyreiad2yqm6qwrpshalzscz644qp3osayprmcddvhwo2dywiqffrm2bi	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22	2022-07-15T00:48:57.914Z
103	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmaeaek22	bafyreihkzh7ny5yrxqemvybg3i7777fj7mfnde6xeyrt4wmxjs5rljgoge	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6zuvk22	2022-07-15T00:49:02.914Z
104	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmaeaek22	bafyreihkzh7ny5yrxqemvybg3i7777fj7mfnde6xeyrt4wmxjs5rljgoge	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22	2022-07-15T00:49:02.914Z
106	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmagjmc22	bafyreiapglbozxgvrngr3i56brbaukc5udsdbwsmmp7axguqscbtavuz6m	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6sar222	2022-07-15T00:49:05.914Z
107	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmagjmc22	bafyreiapglbozxgvrngr3i56brbaukc5udsdbwsmmp7axguqscbtavuz6m	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6p55k22	2022-07-15T00:49:05.914Z
116	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmamvpk22	bafyreigzm756fmbrj22rhawr7cojojnc7g3bu32rzjw6armvhpfjvvkgz4	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmagjmc22	2022-07-15T00:49:13.914Z
118	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmamvpk22	bafyreigzm756fmbrj22rhawr7cojojnc7g3bu32rzjw6armvhpfjvvkgz4	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6p55k22	2022-07-15T00:49:13.914Z
35	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm76di222	bafyreict3zjalmndopvzm4rd5nzx2lz3spqnphfzifmoz7f3odke2jqptq	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	2022-07-15T00:48:08.914Z
38	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7aby222	bafyreicwdnl52rm2basxdhgvcwvmac6iesq34njgbbschzx4usgzsf42ei	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6qcb222	2022-07-15T00:48:10.914Z
40	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7dqdc22	bafyreig63wu7skovixex2waesavh2ifjmbxbgohfggaag35kkmovwh2u7u	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xaw222	2022-07-15T00:48:15.914Z
41	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7dqdc22	bafyreig63wu7skovixex2waesavh2ifjmbxbgohfggaag35kkmovwh2u7u	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6twhs22	2022-07-15T00:48:15.914Z
50	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7hles22	bafyreiat6kavehlet5nmwsgctjpeukavhtkalikajn54efgle2mmv2opzu	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6qxqk22	2022-07-15T00:48:21.914Z
51	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7hles22	bafyreiat6kavehlet5nmwsgctjpeukavhtkalikajn54efgle2mmv2opzu	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	2022-07-15T00:48:21.914Z
55	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7jpqc22	bafyreiarkx6bnx7jvqoqbq7aozirex5v2356rf2zztbuuwxxfnn7ibqoly	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	2022-07-15T00:48:24.914Z
69	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7s6ak22	bafyreiaccvsbkagfya76xdapjcg7ifgmt5fqew4sljcptcbqdlso3rkqpy	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6twhs22	2022-07-15T00:48:37.914Z
70	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7s6ak22	bafyreiaccvsbkagfya76xdapjcg7ifgmt5fqew4sljcptcbqdlso3rkqpy	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22	2022-07-15T00:48:37.914Z
108	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmahcys22	bafyreiazaf56e45jmxntxyybs6hvwujxn4t23nf25oa76nzrn43jnlctoy	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7gafs22	2022-07-15T00:49:06.914Z
126	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmatcs222	bafyreidgreob26umndt3fictf3aj6p57ntlw3ung3rixldeomvlv3n6ggy	did:plc:awpz77o4dyluwpa2j2p2oqgs	like	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm63k7222	2022-07-15T00:49:23.914Z
129	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmaxgms22	bafyreigx6de6nh4rphd2ugsudtcbpthevbz77n2bnh67xvrxowqpfludy4	did:plc:awpz77o4dyluwpa2j2p2oqgs	like	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm66hx222	2022-07-15T00:49:31.914Z
135	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmb567s22	bafyreib63htruqay7izxfhugbujvr546fntcya2dc3zd2ph3qajejsr3fa	did:plc:5ssevsxo3qyovxpgkg3n2tfs	like	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6lgyc22	2022-07-15T00:49:42.914Z
138	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmb76oc22	bafyreidcnsfupzhs4jfqjgy3bjhwo7anrva4zfllwe2gm2l2qqlawssiey	did:plc:5ssevsxo3qyovxpgkg3n2tfs	like	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ndjs22	2022-07-15T00:49:46.914Z
140	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbajnc22	bafyreihjdf4rjtedv2iunnkge6orfvhfxggymubyny3qiwq3l43q4xdxhi	did:plc:awpz77o4dyluwpa2j2p2oqgs	like	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6pppc22	2022-07-15T00:49:48.914Z
146	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbgf5c22	bafyreicieje66isblikhgjer6wsila2sta7ocqln4ykubhv3ewojuxymae	did:plc:zluht54hsscg6octtayzd3ft	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm72ncs22	2022-07-15T00:49:57.914Z
151	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbjmns22	bafyreigvoziqloafdu3gpobmbrnjp4jnhjob7cxb5cfurhdod7ei3pvrgq	did:plc:zluht54hsscg6octtayzd3ft	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm74gwk22	2022-07-15T00:50:03.914Z
155	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbn3yc22	bafyreibkxjdp5btj3ocntytbtafptri4aknszjfsjqrmwxmjpm25s66ima	did:plc:5ssevsxo3qyovxpgkg3n2tfs	like	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm76di222	2022-07-15T00:50:10.914Z
168	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbzt7k22	bafyreih5oe3p2wvmax4sukn34j3jw3jds6u6jdujwgi2fa7fx4ycxiq5se	did:plc:awpz77o4dyluwpa2j2p2oqgs	like	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7pn6s22	2022-07-15T00:50:34.914Z
169	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmc2ug222	bafyreig7fe35orakwfc2t3zhfknjqo5tftp47ehx7puq6jvmombjnppt4e	did:plc:zluht54hsscg6octtayzd3ft	like	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7qz5222	2022-07-15T00:50:36.914Z
172	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmc56n222	bafyreihmavkyedlmpk3dybwwupuzgqx3pkaou6djlbcr42avxnr44ntgje	did:plc:awpz77o4dyluwpa2j2p2oqgs	like	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7rkpk22	2022-07-15T00:50:40.914Z
177	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmccqek22	bafyreibhfjtjo6el5sfekkfdam2umf2bpj7yqrlr3x4h4tht7klkchkn7y	did:plc:awpz77o4dyluwpa2j2p2oqgs	like	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7zepk22	2022-07-15T00:50:50.914Z
192	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmcrnvs22	bafyreibadnb666cxta3b3brvr74bpllyy6gxmcjsl4xk6tvnfuykhyme2i	did:plc:zluht54hsscg6octtayzd3ft	like	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmao7pc22	2022-07-15T00:51:16.914Z
194	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcthjk22	bafyreibj6tu3zd2tqme5ivwublwrnwwb2sts5uriiv2riqzi7lyam7fqp4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	like	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmapbv222	2022-07-15T00:51:19.914Z
37	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm77cq222	bafyreifxrysbjhvhafppbgxwgg6tm6ye4iq56d6wft5ivjo6tyu7yke3be	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	2022-07-15T00:48:09.914Z
46	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7fjx222	bafyreigtv3xbvf7zecdzzaljrirvng6dn25cuzu2s7vrwejalkx3boli7e	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6m2jc22	2022-07-15T00:48:18.914Z
47	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7fjx222	bafyreigtv3xbvf7zecdzzaljrirvng6dn25cuzu2s7vrwejalkx3boli7e	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm63k7222	2022-07-15T00:48:18.914Z
58	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7l2pc22	bafyreicho5whst5kg2exmu7jl4yk7iyihmpqqkvdqx2sa4tkitxsdxsrgu	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6zuvk22	2022-07-15T00:48:26.914Z
65	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7pn6s22	bafyreigvlrrozbjn3gxkcp44pspjbmtawgdxjw7qytnv2ts3rtqzgvpsqy	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7mcqk22	2022-07-15T00:48:33.914Z
71	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7qz5222	bafyreihxtuaj4wfbyqjyswvscr5y7m7e7ojymxltfvrcyilg7z3yu5t7bi	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm72ncs22	2022-07-15T00:48:35.914Z
72	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7sxn222	bafyreihnw6l32rjmtkvt5s56doimw5lfu2ymwfqftnlc2euhdcmmnlqnz4	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm75mzc22	2022-07-15T00:48:38.914Z
73	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7sxn222	bafyreihnw6l32rjmtkvt5s56doimw5lfu2ymwfqftnlc2euhdcmmnlqnz4	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	2022-07-15T00:48:38.914Z
76	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7uw5222	bafyreieouj26ubtzwd43olrtigwuhdlj4e555waytjfp65lp4wahvh6eva	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7jpqc22	2022-07-15T00:48:41.914Z
81	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7xk4k22	bafyreicbzb7gpl5n6syjqqzgix6cejwvmz7aquf2sgbkq7gt7zinc34s6y	did:plc:awpz77o4dyluwpa2j2p2oqgs	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6zuvk22	2022-07-15T00:48:45.914Z
84	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7zepk22	bafyreiavtz5pbqpzdwdns6cuk7tijrjueb7am77rdihyx3in5ytparccda	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6v7ic22	2022-07-15T00:48:47.914Z
85	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7zepk22	bafyreiavtz5pbqpzdwdns6cuk7tijrjueb7am77rdihyx3in5ytparccda	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	2022-07-15T00:48:47.914Z
89	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma5enc22	bafyreifhrml2m2oqyue37mn2iwlsirdnpjues76yufy5invzhigguanita	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22	2022-07-15T00:48:53.914Z
92	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma46kk22	bafyreicgt73gbvybblwvgog63c73uoyvzkiwpflu2zi2dbywpnafz3r7mi	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7p2n222	2022-07-15T00:48:51.914Z
93	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma46kk22	bafyreicgt73gbvybblwvgog63c73uoyvzkiwpflu2zi2dbywpnafz3r7mi	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6zuvk22	2022-07-15T00:48:51.914Z
96	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma7h2c22	bafyreidrqkwmhh2yxhpkbisqufrib2mysgrztuof6s2ur6p7362n5ozk4q	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7wa4s22	2022-07-15T00:48:56.914Z
98	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmac3z222	bafyreiahz6chrakkw7en4ceothts6uyxlualmbsgaaaruneiouc4t4uqa4	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	2022-07-15T00:48:59.914Z
122	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmar4i222	bafyreiggkxvej75yamo77xvn52ua3uq5g6bonyq66ewaon4zzjn6cit6am	did:plc:zluht54hsscg6octtayzd3ft	like	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	2022-07-15T00:49:19.914Z
128	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmaweh222	bafyreideunwwwbmgynidmrn3iopxf7s5jrquyu6ay6f2wuhqdvyd5r5tta	did:plc:5ssevsxo3qyovxpgkg3n2tfs	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65frc22	2022-07-15T00:49:29.914Z
132	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmb24ks22	bafyreiahh4xmqyp3tz7m67da4he2666fbsfnkm3x6gws7z4heveto6soba	did:plc:zluht54hsscg6octtayzd3ft	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6c27c22	2022-07-15T00:49:36.914Z
139	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmb7qas22	bafyreicv5j6o4ykufpkoazq3hexj6gusojcok37mgvcrbmchpaqhilet4y	did:plc:awpz77o4dyluwpa2j2p2oqgs	like	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ndjs22	2022-07-15T00:49:47.914Z
141	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbba4222	bafyreiajjhrxsx5k3w2mko5rpkkkxj25mxfevrusu5xja47hbrxhgrr4cy	did:plc:zluht54hsscg6octtayzd3ft	like	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6qcb222	2022-07-15T00:49:49.914Z
147	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbgznk22	bafyreihe257r3gmtdugqo6rhcy3rkttclqq5zodrr27wl54bah7hadvpm4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm72ncs22	2022-07-15T00:49:58.914Z
149	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbhla222	bafyreifsmcuz7vhe33xmxwxhjfdmi3ejt3yskiqoxoghysxm6f6upvhfiu	did:plc:zluht54hsscg6octtayzd3ft	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm73bt222	2022-07-15T00:49:59.914Z
105	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmaexsk22	bafyreia25f2teavzep54pf5lpmj2c5cstertmc6uzsit6vt72k7bqlb4cm	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	2022-07-15T00:49:03.914Z
110	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmaj7kc22	bafyreic5guwbepjlbejxy5lpjcmnkjgkbjn5bdtyp3hy6uzr57hyev2ify	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reply	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22	2022-07-15T00:49:08.914Z
115	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmam7as22	bafyreidnh6h34yqwjgg65zdxkd35jms6vggpkc3abjojoy2bjcrmbb3f6i	did:plc:zluht54hsscg6octtayzd3ft	reply	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	2022-07-15T00:49:12.914Z
130	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmaxz6k22	bafyreicybv3yh4ct7jxsftjcnb6rsxv5g7zsnx3v4ebe2fr7hx32s7sru4	did:plc:zluht54hsscg6octtayzd3ft	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22	2022-07-15T00:49:32.914Z
131	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmazmws22	bafyreib34xvqst3kwka5cvzqajl7wmif6hyh6rspd23yndilzqm4zkkery	did:plc:5ssevsxo3qyovxpgkg3n2tfs	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6bhnk22	2022-07-15T00:49:35.914Z
143	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbctuc22	bafyreidvq4gvnuv4xljymgksp3nycmb7hu7abllqx23nfkm7tjgblgxsxq	did:plc:zluht54hsscg6octtayzd3ft	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6sar222	2022-07-15T00:49:51.914Z
144	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbears22	bafyreievpmbxokg5kzhvgjqjzlgx3pjgn5mhv2wyta4t4k6nd2aasijoxq	did:plc:zluht54hsscg6octtayzd3ft	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xaw222	2022-07-15T00:49:53.914Z
148	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbi3tc22	bafyreih3hpi3al2jzpylkosfoeugbwnytdmvgnbjutu44qltv7mbitecj4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm73bt222	2022-07-15T00:50:00.914Z
152	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbkmv222	bafyreigkg4uyc27qgxcguhpvkey26h6nyri2dpifgetb6d3buamv7cnivq	did:plc:zluht54hsscg6octtayzd3ft	like	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm74zic22	2022-07-15T00:50:05.914Z
154	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbmmec22	bafyreiek5nv7z3a35mvontvizqjjy7azdabuvenlsoweybc5wxgx7rpwim	did:plc:awpz77o4dyluwpa2j2p2oqgs	like	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm75mzc22	2022-07-15T00:50:09.914Z
159	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbrfok22	bafyreihzed2l3txajnevmpai5vol55pmgkdmz5msukfodpdfbusmy7heeq	did:plc:5ssevsxo3qyovxpgkg3n2tfs	like	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7gafs22	2022-07-15T00:50:18.914Z
162	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbuzvc22	bafyreigwerbfwqa6i4cyelqoglubu3dpizt356zien253iqbw6j3ajqgh4	did:plc:zluht54hsscg6octtayzd3ft	like	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7keak22	2022-07-15T00:50:25.914Z
165	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbwaxc22	bafyreihbspp5xbc6ml5gfceyxtw45dep5wxvfeebqfeionivw4cij2lbea	did:plc:zluht54hsscg6octtayzd3ft	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7mcqk22	2022-07-15T00:50:27.914Z
179	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmcdtjk22	bafyreifiziaxzag2oggjdnxqfc7vdcxqi7dflysktlxavasgubf23is2gi	did:plc:awpz77o4dyluwpa2j2p2oqgs	like	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma2qns22	2022-07-15T00:50:52.914Z
183	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcfm6222	bafyreifzduvnwhgwqlmic6m3gidpwmdvj7d3jqw2lygc2xtjncyquyauvm	did:plc:5ssevsxo3qyovxpgkg3n2tfs	like	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma4s3k22	2022-07-15T00:50:55.914Z
184	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmchipk22	bafyreidxda7p6snwpxwiwpkxe6hot3hhb7utw2z6wlzdxxdqm7kdj4jwvm	did:plc:zluht54hsscg6octtayzd3ft	like	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma7h2c22	2022-07-15T00:50:58.914Z
190	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcnk3222	bafyreiejzhawlvggqqhqe2wkinlgjzx5zeqmvumhj5mfbcf67wy74ylk2a	did:plc:5ssevsxo3qyovxpgkg3n2tfs	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmaig5s22	2022-07-15T00:51:09.914Z
195	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcu32k22	bafyreigage754fwqjpknehxb25gmqrs6h7detvpyqvpayo22o5bvsngswm	did:plc:5ssevsxo3qyovxpgkg3n2tfs	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmapzd222	2022-07-15T00:51:20.914Z
145	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbftks22	bafyreib2f4wydqjqjajesllltoajse7ctcxs5um7l2d243wd3xeg4de7jq	did:plc:5ssevsxo3qyovxpgkg3n2tfs	like	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6zbek22	2022-07-15T00:49:56.914Z
164	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbwrkk22	bafyreidqjad7dl664tizb6ywszf4ic6p56tp3j2yyynboau6dzng7envf4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	like	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7mz7c22	2022-07-15T00:50:28.914Z
166	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbytxk22	bafyreiexxhkswyhqohiwjwaubcqrbbyoqlmwfpo3n2dc6ogvt3cqxlhheu	did:plc:5ssevsxo3qyovxpgkg3n2tfs	like	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7of5k22	2022-07-15T00:50:32.914Z
170	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmc43i222	bafyreidknw2bsnalk37yjux7t3jk6xmlji23x3m2muzkodl5pkpcsdwqjq	did:plc:awpz77o4dyluwpa2j2p2oqgs	like	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7qz5222	2022-07-15T00:50:38.914Z
174	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmc6uds22	bafyreiciixvr6gqhjit52roy6vutzmjhklhngq26degsj4fs62be7euhvy	did:plc:zluht54hsscg6octtayzd3ft	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7uank22	2022-07-15T00:50:43.914Z
176	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcbhe222	bafyreihim7d3yj4rcddzmnnb2e24hobzjnnzmm5dbnaxnoivxkwbpep4fq	did:plc:5ssevsxo3qyovxpgkg3n2tfs	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7wtns22	2022-07-15T00:50:48.914Z
181	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmcg7p222	bafyreifugmuoj4jabvu7ytmsii56znzg75ldyr7j6e4cdslarysugtvz7e	did:plc:zluht54hsscg6octtayzd3ft	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkma5z5k22	2022-07-15T00:50:56.914Z
185	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcjcdc22	bafyreiekh76fl7e4oaowdz7ogeszyy5d2f5lmc45bji6bcwimjdrgkirau	did:plc:5ssevsxo3qyovxpgkg3n2tfs	like	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmac3z222	2022-07-15T00:51:01.914Z
187	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmckfic22	bafyreicpm3fs6yfggfoqbqwhjuomzxqgff3pe3zjewfsaz555rig5mibwm	did:plc:5ssevsxo3qyovxpgkg3n2tfs	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmadluc22	2022-07-15T00:51:03.914Z
189	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmcolbk22	bafyreihaab5tdspmlbelt2itx4m4hzuqvw4mx22i66fx54b2e4qbvvlc2e	did:plc:zluht54hsscg6octtayzd3ft	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmajvz222	2022-07-15T00:51:11.914Z
193	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmcsdfc22	bafyreic757whyqhknlbaoxt3w5wazhhxzcrww72cegiohrtlfwk75u2fcy	did:plc:awpz77o4dyluwpa2j2p2oqgs	like	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmao7pc22	2022-07-15T00:51:17.914Z
197	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmczvlc22	bafyreihpqekop6rp4kktj2tsxalz5lm6k3qiee4syzhxh5vyigc2rmby4i	did:plc:5ssevsxo3qyovxpgkg3n2tfs	like	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.generator/alice-favs	2022-07-15T00:51:27.914Z
150	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbilhc22	bafyreidk5aescftg3msca2e5njfqkygob7wh32jx4ujn6qtrjmwunlnrlu	did:plc:5ssevsxo3qyovxpgkg3n2tfs	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm73ues22	2022-07-15T00:50:01.914Z
156	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbob3s22	bafyreibadqwgadjly75stbccw6zkgw5rjqut6x72zmijhkjuabspmezzpi	did:plc:5ssevsxo3qyovxpgkg3n2tfs	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7awic22	2022-07-15T00:50:12.914Z
158	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbqw2k22	bafyreicrgqiemo3pt7aiupib7af65oyhtg7fchkwzr3tl4espfljybvc5e	did:plc:awpz77o4dyluwpa2j2p2oqgs	like	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7eetk22	2022-07-15T00:50:17.914Z
160	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbsmqk22	bafyreigsjjhuwmm6nbup7uxrni5i5lxrsbaymhzprs2hquqrrtmz4tivcq	did:plc:zluht54hsscg6octtayzd3ft	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7hles22	2022-07-15T00:50:20.914Z
161	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbu3mk22	bafyreiahifws4jvb77spn5azueio26ujbfrfazyt6rggpeofcqsmalilfi	did:plc:zluht54hsscg6octtayzd3ft	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7j2as22	2022-07-15T00:50:23.914Z
182	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmcgrbk22	bafyreidzhif23rfvszfyfvmvaya343vimx5ipzg5zdzafa2u5afvsmlodq	did:plc:awpz77o4dyluwpa2j2p2oqgs	like	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma6pmc22	2022-07-15T00:50:57.914Z
186	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmcjuv222	bafyreigetbwhgwrdaoq5y2inazxf26gu7nxhhm3qop56d5e4trrsu6wz6i	did:plc:zluht54hsscg6octtayzd3ft	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmadluc22	2022-07-15T00:51:02.914Z
188	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmcmjts22	bafyreihwxolbkbesf4vqlrrqorl5qcl3p5ksgler4lpzr5w3wjs4u2dm4a	did:plc:zluht54hsscg6octtayzd3ft	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmahcys22	2022-07-15T00:51:07.914Z
191	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcp5tc22	bafyreiefl4mx337teehxvlt5bmgsdjsbce5wtekzebh4hq4g3v7gz5vwga	did:plc:5ssevsxo3qyovxpgkg3n2tfs	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmajvz222	2022-07-15T00:51:12.914Z
175	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmc7vkc22	bafyreifcyxjw2dee4skfn7yanpjynxwhvgge5dlqvernklzqkfj57v7seq	did:plc:awpz77o4dyluwpa2j2p2oqgs	like	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7uw5222	2022-07-15T00:50:45.914Z
178	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcc5ss22	bafyreihhgmrglznmlqlelmbyzyg2rhpshycvzpzcwuz734mo4iwub3i3te	did:plc:5ssevsxo3qyovxpgkg3n2tfs	like	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7ymcc22	2022-07-15T00:50:49.914Z
180	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmceh2k22	bafyreigdubfzfex653l4at2a6akexq5wvevbsf3zoec5cy3sd6c6mnfp3u	did:plc:5ssevsxo3qyovxpgkg3n2tfs	like	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma46kk22	2022-07-15T00:50:53.914Z
196	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcvixc22	bafyreicnb2dwv2ks3hxqen6e4oa3sldre7ajeikdzzzf7t7zjeadkukhla	did:plc:5ssevsxo3qyovxpgkg3n2tfs	like	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmaqlus22	2022-07-15T00:51:22.914Z
198	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmd2g6k22	bafyreifjcbyw2ygsq7v6ba2kgrgzkc4725lrytrbupd6p7ocfulxj3yetq	did:plc:awpz77o4dyluwpa2j2p2oqgs	like	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.generator/alice-favs	2022-07-15T00:51:28.914Z
\.


--
-- Data for Name: notification_push_token; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.notification_push_token (did, platform, token, "appId") FROM stdin;
\.


--
-- Data for Name: post; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.post (uri, cid, creator, text, "replyRoot", "replyRootCid", "replyParent", "replyParentCid", "createdAt", "indexedAt", langs, "invalidReplyRoot", "violatesThreadGate", tags) FROM stdin;
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	Nervous?\nYes. Very.\nFirst time?\nNo, I've been nervous lots of times.	\N	\N	\N	\N	2022-07-15T00:47:17.914Z	2024-06-07T12:43:08.217Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm5zpm222	bafyreibl6nrxujzusdkawwdxoegdgbysqt3wu7xrpimtyeqij4ldrdpvt4	did:plc:zluht54hsscg6octtayzd3ft	I am serious...and don't call me Shirley.	\N	\N	\N	\N	2022-07-15T00:47:18.914Z	2024-06-07T12:43:08.276Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22	bafyreicwid24ntku3kmqruypwpgsdkpanhg2emvdvbkuvn3fmppxzlhdqa	did:plc:zluht54hsscg6octtayzd3ft	Looks like I picked the wrong week to quit smoking.	\N	\N	\N	\N	2022-07-15T00:47:19.914Z	2024-06-07T12:43:08.290Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm63k7222	bafyreidwwfbydjpoh5pm363uhfzdejxsuutwm4cpsv2ptht4x5q5ug22by	did:plc:5ssevsxo3qyovxpgkg3n2tfs	Looks like I picked the wrong week to quit drinking.	\N	\N	\N	\N	2022-07-15T00:47:20.914Z	2024-06-07T12:43:08.334Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22	bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e	did:plc:awpz77o4dyluwpa2j2p2oqgs	Looks like I picked the wrong week to quit amphetamines.	\N	\N	\N	\N	2022-07-15T00:47:21.914Z	2024-06-07T12:43:08.348Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64eks22	bafyreiahrxynudxg5rk76kw5mbcr65gjuli76szgmm3m3bso6ewxtkyngq	did:plc:5ssevsxo3qyovxpgkg3n2tfs	Looks like I picked the wrong week to quit sniffing glue.	\N	\N	\N	\N	2022-07-15T00:47:22.914Z	2024-06-07T12:43:08.361Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65frc22	bafyreidwj4haslqlsrycp5uc2kaoupd5vbgaoxzsxzbwwydcguec4catcu	did:plc:awpz77o4dyluwpa2j2p2oqgs	Ladies and gentlemen, this is your stewardess speaking... We regret any inconvenience the sudden cabin movement might have caused, and we hope you enjoy the rest of your flight... By the way, is there anyone on board who knows how to fly a plane? 	\N	\N	\N	\N	2022-07-15T00:47:24.914Z	2024-06-07T12:43:08.397Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm66hx222	bafyreidxjakkbifqysatmszjyvoa3usbnenyadx2dvxhebektepcvu4hry	did:plc:zluht54hsscg6octtayzd3ft	These people need to go to a hospital.\nWhat is it?\nIt's a big place where sick people go, but that's not important right now.	\N	\N	\N	\N	2022-07-15T00:47:26.914Z	2024-06-07T12:43:08.433Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22	bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu	did:plc:5ssevsxo3qyovxpgkg3n2tfs	Captain, how soon can we land?\nI can't tell.\nYou can tell me, I'm a doctor.	\N	\N	\N	\N	2022-07-15T00:47:23.914Z	2024-06-07T12:43:08.381Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by	did:plc:awpz77o4dyluwpa2j2p2oqgs	Joey, have you ever been in a turkish prison?	\N	\N	\N	\N	2022-07-15T00:47:25.914Z	2024-06-07T12:43:08.415Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22	bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm	did:plc:awpz77o4dyluwpa2j2p2oqgs	I just want to tell you both good luck. We're all counting on you.	\N	\N	\N	\N	2022-07-15T00:47:27.914Z	2024-06-07T12:43:08.451Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6ax2c22	bafyreicphr7ig7gn4uabxqoocganwhi5njug2flpfc2m4ggdirmgiu5glq	did:plc:awpz77o4dyluwpa2j2p2oqgs	Joey, do you like movies about gladiators?	\N	\N	\N	\N	2022-07-15T00:47:28.914Z	2024-06-07T12:43:08.514Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6bhnk22	bafyreiceit7gbs5xammejxeej665pnliyxyogmf4fqkvmakundsmd7mooe	did:plc:awpz77o4dyluwpa2j2p2oqgs	Captain, maybe we ought to turn on the searchlights now.\nNo… that’s just what they’ll be expecting us to do.	\N	\N	\N	\N	2022-07-15T00:47:29.914Z	2024-06-07T12:43:08.533Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6cnqc22	bafyreid273gys3wrzpedo7uguxwxq6c5iqyji63uqrbxq7xd2v5645rrja	did:plc:zluht54hsscg6octtayzd3ft	I need the best man on this. Someone who knows that plane inside and out and won’t crack under pressure. How about Mister Rogers?	\N	\N	\N	\N	2022-07-15T00:47:31.914Z	2024-06-07T12:43:08.568Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22	bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	Jim never vomits at home.	\N	\N	\N	\N	2022-07-15T00:47:33.914Z	2024-06-07T12:43:08.602Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6c27c22	bafyreiajg2rg4ysiluze35qqjdymgc7sy34ovwssevuqpvxvxozsodocp4	did:plc:awpz77o4dyluwpa2j2p2oqgs	Johnny, what can you make out of this?\n  This? Why, I can make a hat or a brooch or a pterodactyl…	\N	\N	\N	\N	2022-07-15T00:47:30.914Z	2024-06-07T12:43:08.549Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6er4k22	bafyreifed7rbzncumo543gdaydnaprdl2aokx725gk6cfruqimwngkfw2e	did:plc:zluht54hsscg6octtayzd3ft	The life of everyone on board depends upon just one thing: finding someone back there who can not only fly this plane, but who didn't have fish for dinner.	\N	\N	\N	\N	2022-07-15T00:47:35.914Z	2024-06-07T12:43:08.637Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22	bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu	did:plc:awpz77o4dyluwpa2j2p2oqgs	What was it we had for dinner tonight?\nWell, we had a choice of steak or fish.\nYes, yes, I remember, I had lasagna.	\N	\N	\N	\N	2022-07-15T00:47:32.914Z	2024-06-07T12:43:08.586Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22	bafyreifsazs5bwjay324fnkz5ecluwy4bpehh5iwdkwmerj7ywhjj7pcnq	did:plc:zluht54hsscg6octtayzd3ft	Shanna, they bought their tickets, they knew what they were getting into. I say, let 'em crash.	\N	\N	\N	\N	2022-07-15T00:47:36.914Z	2024-06-07T12:43:08.756Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6k6x222	bafyreicbtupktruxgtg3wyw3ptx6ntmmchwyapczem2p24cbhynm24amxm	did:plc:5ssevsxo3qyovxpgkg3n2tfs	naughty post	\N	\N	\N	\N	2022-07-15T00:47:37.914Z	2024-06-07T12:43:08.818Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6lgyc22	bafyreiarenp2r55zrv52fnig3wyttvdcluenvbu2m3oqte7qn4js54f5dq	did:plc:zluht54hsscg6octtayzd3ft	fire	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	2022-07-15T00:47:39.914Z	2024-06-07T12:43:08.857Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6kpkc22	bafyreiabae2vvj5z2jaqmxsmskvay5gnmlgiump7ol2kgebvnwhyacr5ou	did:plc:5ssevsxo3qyovxpgkg3n2tfs	reallly bad post should be deleted	\N	\N	\N	\N	2022-07-15T00:47:38.914Z	2024-06-07T12:43:08.831Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6m2jc22	bafyreigfwyy5uw74g2gkfilquplidccubgxpvdihuvwjnkag2iogetp5fu	did:plc:zluht54hsscg6octtayzd3ft	Wen token	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm63k7222	bafyreidwwfbydjpoh5pm363uhfzdejxsuutwm4cpsv2ptht4x5q5ug22by	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm63k7222	bafyreidwwfbydjpoh5pm363uhfzdejxsuutwm4cpsv2ptht4x5q5ug22by	2022-07-15T00:47:40.914Z	2024-06-07T12:43:08.877Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22	bafyreicyq7eldus5jwjulcgmbijfzkiqyfbnoo74fmowj5n2ydxqc4q7he	did:plc:zluht54hsscg6octtayzd3ft	fire	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	2022-07-15T00:47:41.914Z	2024-06-07T12:43:08.899Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6pppc22	bafyreibd6kqdmg5bvqvfme3nu76crz5hpdygbuvtfo5z6gmn73pm23c4bi	did:plc:5ssevsxo3qyovxpgkg3n2tfs	Wen token	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by	2022-07-15T00:47:46.914Z	2024-06-07T12:43:08.996Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6rna222	bafyreifuxoreut7uuibyzm5wmrl2wefsc4e3ksoeunj4k5fmntrciairi4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	Wen token	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22	bafyreicwid24ntku3kmqruypwpgsdkpanhg2emvdvbkuvn3fmppxzlhdqa	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22	bafyreicwid24ntku3kmqruypwpgsdkpanhg2emvdvbkuvn3fmppxzlhdqa	2022-07-15T00:47:49.914Z	2024-06-07T12:43:09.059Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6twhs22	bafyreiazf5m4p3ly542yppowxjctwxq6bo7wqn3vxhwlw4zf6gafagjdmi	did:plc:zluht54hsscg6octtayzd3ft	Wen token	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22	bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22	bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu	2022-07-15T00:47:52.914Z	2024-06-07T12:43:09.135Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6zbek22	bafyreibs7cdwlfhlykogfpj5yimdk62ttoq5gn4akjk65zykistm4pk7cy	did:plc:zluht54hsscg6octtayzd3ft	ugh when will hashtags get supported in this app	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22	bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22	bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu	2022-07-15T00:48:00.914Z	2024-06-07T12:43:09.310Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm74gwk22	bafyreibjfpn3ozc6rjzkjytahzatd77uarqqnnswivuvi2suhdycsmcflu	did:plc:awpz77o4dyluwpa2j2p2oqgs	Wen token	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22	bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6wiis22	bafyreigfuziopyoqcyv5jx6n7farmuxqmt6o3eeyszctl2xveyahtucnhe	2022-07-15T00:48:05.914Z	2024-06-07T12:43:09.413Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7gvvc22	bafyreiglrva5gmt5mumpuj55c2wxbnknijfsztiz6n7imalmlv63a4bhk4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	What does this mean for pet owners in the midterms?	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22	bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7dqdc22	bafyreig63wu7skovixex2waesavh2ifjmbxbgohfggaag35kkmovwh2u7u	2022-07-15T00:48:20.914Z	2024-06-07T12:43:09.757Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7ihp222	bafyreictq5xj4uggp3kaonouugalckasgzcvihlygzrbgnkz3npv3umhyu	did:plc:awpz77o4dyluwpa2j2p2oqgs	What does this mean for pet owners in the midterms?	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22	bafyreifsazs5bwjay324fnkz5ecluwy4bpehh5iwdkwmerj7ywhjj7pcnq	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm74zic22	bafyreibom4ih33aggpyno5jlmjlaxjybicxr3wcotkmaf4xqila67dnhhu	2022-07-15T00:48:22.914Z	2024-06-07T12:43:09.807Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7keak22	bafyreib5eet7fqeo3c7yujtnsvudsfcb44tmzxhcvxa6ogev2q6t5yfa5q	did:plc:5ssevsxo3qyovxpgkg3n2tfs	Wen token	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6qcb222	bafyreideidtqpviy6deov3hiv2bph4ngud6snrf3rqj62e7n56me3accuy	2022-07-15T00:48:25.914Z	2024-06-07T12:43:09.871Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7lp7k22	bafyreibtftyjrbiemgppzwvro2sm3mqryfdya3wuuqw3q7vcfproc6z5a4	did:plc:zluht54hsscg6octtayzd3ft	ugh when will hashtags get supported in this app	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm5zpm222	bafyreibl6nrxujzusdkawwdxoegdgbysqt3wu7xrpimtyeqij4ldrdpvt4	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm5zpm222	bafyreibl6nrxujzusdkawwdxoegdgbysqt3wu7xrpimtyeqij4ldrdpvt4	2022-07-15T00:48:27.914Z	2024-06-07T12:43:09.914Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7npo222	bafyreifktbxrueu6rfzzmsva4wn6cso23x4qrxcjqgrrk4f6upo4t6dd2m	did:plc:5ssevsxo3qyovxpgkg3n2tfs	Haha ikr	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22	bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7dqdc22	bafyreig63wu7skovixex2waesavh2ifjmbxbgohfggaag35kkmovwh2u7u	2022-07-15T00:48:30.914Z	2024-06-07T12:43:09.980Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7p2n222	bafyreigiqmzmew4cu6eeualqhurezkrtsunelk3hnzpc7ot3o23lhornvq	did:plc:awpz77o4dyluwpa2j2p2oqgs	ugh when will hashtags get supported in this app	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22	bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7l2pc22	bafyreicho5whst5kg2exmu7jl4yk7iyihmpqqkvdqx2sa4tkitxsdxsrgu	2022-07-15T00:48:32.914Z	2024-06-07T12:43:10.024Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7rkpk22	bafyreifl3toeqtvxgbdmp6ov6mcxxivj2entj66xn4x4kfvpp42m7gqr5q	did:plc:zluht54hsscg6octtayzd3ft	Haha ikr	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22	bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7cbhc22	bafyreiczpp4iuoulzhklxt5adsz7eamtxr5pq45bnm2g4pa2opidgc2r3u	2022-07-15T00:48:36.914Z	2024-06-07T12:43:10.106Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ndjs22	bafyreibbfl3v22jf4vneuwi3wy73d3t2xnqdc4cnb6dqhh4oxwqf6xuxsm	did:plc:zluht54hsscg6octtayzd3ft	What does this mean for pet owners in the midterms?	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22	bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22	bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4	2022-07-15T00:47:42.914Z	2024-06-07T12:43:08.919Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6qcb222	bafyreideidtqpviy6deov3hiv2bph4ngud6snrf3rqj62e7n56me3accuy	did:plc:5ssevsxo3qyovxpgkg3n2tfs	This is sort of accurate, but honestly it misses a huge part of the issue at hand. There are just so many factors and I don't think a vibe is enough to cover it.	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22	bafyreicyq7eldus5jwjulcgmbijfzkiqyfbnoo74fmowj5n2ydxqc4q7he	2022-07-15T00:47:47.914Z	2024-06-07T12:43:09.016Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6qxqk22	bafyreigytipb36mr5photttbnc7yrmy75tnwvcvohx3kg56vod5n522slq	did:plc:zluht54hsscg6octtayzd3ft	is it cool if I DM?	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22	bafyreicyq7eldus5jwjulcgmbijfzkiqyfbnoo74fmowj5n2ydxqc4q7he	2022-07-15T00:47:48.914Z	2024-06-07T12:43:09.039Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6vszc22	bafyreifgmn2zhq5qstdcc77yedzggkow3gz67c6daubgntpqi7uktqkpam	did:plc:awpz77o4dyluwpa2j2p2oqgs	What does this mean for pet owners in the midterms?	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64eks22	bafyreiahrxynudxg5rk76kw5mbcr65gjuli76szgmm3m3bso6ewxtkyngq	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64eks22	bafyreiahrxynudxg5rk76kw5mbcr65gjuli76szgmm3m3bso6ewxtkyngq	2022-07-15T00:47:55.914Z	2024-06-07T12:43:09.196Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm77cq222	bafyreifxrysbjhvhafppbgxwgg6tm6ye4iq56d6wft5ivjo6tyu7yke3be	did:plc:zluht54hsscg6octtayzd3ft	What does this mean for pet owners in the midterms?	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22	bafyreicyq7eldus5jwjulcgmbijfzkiqyfbnoo74fmowj5n2ydxqc4q7he	2022-07-15T00:48:09.914Z	2024-06-07T12:43:09.515Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7fjx222	bafyreigtv3xbvf7zecdzzaljrirvng6dn25cuzu2s7vrwejalkx3boli7e	did:plc:awpz77o4dyluwpa2j2p2oqgs	is it cool if I DM?	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm63k7222	bafyreidwwfbydjpoh5pm363uhfzdejxsuutwm4cpsv2ptht4x5q5ug22by	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6m2jc22	bafyreigfwyy5uw74g2gkfilquplidccubgxpvdihuvwjnkag2iogetp5fu	2022-07-15T00:48:18.914Z	2024-06-07T12:43:09.712Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7l2pc22	bafyreicho5whst5kg2exmu7jl4yk7iyihmpqqkvdqx2sa4tkitxsdxsrgu	did:plc:awpz77o4dyluwpa2j2p2oqgs	fire	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22	bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6zuvk22	bafyreihjmjhi6ovt77ffrwdttf4m2xmfi6ug5wczn2xccetuw2nj2racd4	2022-07-15T00:48:26.914Z	2024-06-07T12:43:09.893Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7pn6s22	bafyreigvlrrozbjn3gxkcp44pspjbmtawgdxjw7qytnv2ts3rtqzgvpsqy	did:plc:5ssevsxo3qyovxpgkg3n2tfs	finally! decentralization!	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22	bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7mcqk22	bafyreibc6lqv5cla3g6xfubafiwapmfzvgbakgfwgcwcjkiwpaj4wyooqm	2022-07-15T00:48:33.914Z	2024-06-07T12:43:10.045Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7qz5222	bafyreihxtuaj4wfbyqjyswvscr5y7m7e7ojymxltfvrcyilg7z3yu5t7bi	did:plc:5ssevsxo3qyovxpgkg3n2tfs	fire	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22	bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm72ncs22	bafyreifsu7lckdjbk6tunuxynocyxwfcwafnjsysnyjqtxpse53jj3eyru	2022-07-15T00:48:35.914Z	2024-06-07T12:43:10.088Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7sxn222	bafyreihnw6l32rjmtkvt5s56doimw5lfu2ymwfqftnlc2euhdcmmnlqnz4	did:plc:awpz77o4dyluwpa2j2p2oqgs	Wen token	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm75mzc22	bafyreihwcj7qlqtq4iwyi7vez4bf4akjqjpeysaxqcoyzvg5dgvuzofip4	2022-07-15T00:48:38.914Z	2024-06-07T12:43:10.153Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7uw5222	bafyreieouj26ubtzwd43olrtigwuhdlj4e555waytjfp65lp4wahvh6eva	did:plc:5ssevsxo3qyovxpgkg3n2tfs	What does this mean for pet owners in the midterms?	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7jpqc22	bafyreiarkx6bnx7jvqoqbq7aozirex5v2356rf2zztbuuwxxfnn7ibqoly	2022-07-15T00:48:41.914Z	2024-06-07T12:43:10.216Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7xk4k22	bafyreicbzb7gpl5n6syjqqzgix6cejwvmz7aquf2sgbkq7gt7zinc34s6y	did:plc:awpz77o4dyluwpa2j2p2oqgs	Wen token	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22	bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6zuvk22	bafyreihjmjhi6ovt77ffrwdttf4m2xmfi6ug5wczn2xccetuw2nj2racd4	2022-07-15T00:48:45.914Z	2024-06-07T12:43:10.309Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7zepk22	bafyreiavtz5pbqpzdwdns6cuk7tijrjueb7am77rdihyx3in5ytparccda	did:plc:zluht54hsscg6octtayzd3ft	Wow, so true!	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6v7ic22	bafyreihafcvgqpktxi7ugcwgfru5pm77due6skn6gkkqdq7jw7uodnzwxy	2022-07-15T00:48:47.914Z	2024-06-07T12:43:10.362Z	\N	t	f	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmadluc22	bafyreiccumm4iihqjafzdjj4lhtzwusrwnuefibe4nm3ja337y7zwoqmse	did:plc:awpz77o4dyluwpa2j2p2oqgs	Haha ikr	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22	bafyreicwid24ntku3kmqruypwpgsdkpanhg2emvdvbkuvn3fmppxzlhdqa	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmaa4js22	bafyreiad2yqm6qwrpshalzscz644qp3osayprmcddvhwo2dywiqffrm2bi	2022-07-15T00:49:01.914Z	2024-06-07T12:43:10.697Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6nw3k22	bafyreicznkuorm6ypgy3cgltnqqfncnhd2ddueiwfotpubqfinepkrsm74	did:plc:zluht54hsscg6octtayzd3ft	Wow, so true!	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm5zpm222	bafyreibl6nrxujzusdkawwdxoegdgbysqt3wu7xrpimtyeqij4ldrdpvt4	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm5zpm222	bafyreibl6nrxujzusdkawwdxoegdgbysqt3wu7xrpimtyeqij4ldrdpvt4	2022-07-15T00:47:43.914Z	2024-06-07T12:43:08.937Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6oho222	bafyreidztf4duw63m5xb6uisugocsmehokjp6sb7jyjqwxmu65pyt34s7m	did:plc:zluht54hsscg6octtayzd3ft	ugh when will hashtags get supported in this app	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6lgyc22	bafyreiarenp2r55zrv52fnig3wyttvdcluenvbu2m3oqte7qn4js54f5dq	2022-07-15T00:47:44.914Z	2024-06-07T12:43:08.956Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6t62k22	bafyreia4smzotwpndfww2bxdmhqgovxq7pas5klmjwg2czsx2z6cv56e6m	did:plc:5ssevsxo3qyovxpgkg3n2tfs	fire	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6qxqk22	bafyreigytipb36mr5photttbnc7yrmy75tnwvcvohx3kg56vod5n522slq	2022-07-15T00:47:51.914Z	2024-06-07T12:43:09.113Z	\N	t	f	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6v7ic22	bafyreihafcvgqpktxi7ugcwgfru5pm77due6skn6gkkqdq7jw7uodnzwxy	did:plc:5ssevsxo3qyovxpgkg3n2tfs	ugh when will hashtags get supported in this app	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6uky222	bafyreidokrfnhzk5mnwcicnvw7cuorg2qgnpotk2vicwcuhxeua2cxwur4	2022-07-15T00:47:54.914Z	2024-06-07T12:43:09.177Z	\N	t	f	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6wiis22	bafyreigfuziopyoqcyv5jx6n7farmuxqmt6o3eeyszctl2xveyahtucnhe	did:plc:5ssevsxo3qyovxpgkg3n2tfs	What does this mean for pet owners in the midterms?	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22	bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22	bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm	2022-07-15T00:47:56.914Z	2024-06-07T12:43:09.223Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6zuvk22	bafyreihjmjhi6ovt77ffrwdttf4m2xmfi6ug5wczn2xccetuw2nj2racd4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	ugh when will hashtags get supported in this app	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22	bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22	bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu	2022-07-15T00:48:01.914Z	2024-06-07T12:43:09.331Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm75mzc22	bafyreihwcj7qlqtq4iwyi7vez4bf4akjqjpeysaxqcoyzvg5dgvuzofip4	did:plc:zluht54hsscg6octtayzd3ft	ugh when will hashtags get supported in this app	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22	bafyreicyq7eldus5jwjulcgmbijfzkiqyfbnoo74fmowj5n2ydxqc4q7he	2022-07-15T00:48:07.914Z	2024-06-07T12:43:09.451Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7blxs22	bafyreigzrkdypcw6rzkdswhct6ay552cpzukzcfmrdxdhfi4tx2bfg3yaq	did:plc:zluht54hsscg6octtayzd3ft	Haha ikr	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64eks22	bafyreiahrxynudxg5rk76kw5mbcr65gjuli76szgmm3m3bso6ewxtkyngq	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6vszc22	bafyreifgmn2zhq5qstdcc77yedzggkow3gz67c6daubgntpqi7uktqkpam	2022-07-15T00:48:12.914Z	2024-06-07T12:43:09.583Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7j2as22	bafyreih3yrxva7euqbsiozt473ou6giubfjq5dujecdoehkr7vuggkfxsu	did:plc:awpz77o4dyluwpa2j2p2oqgs	fire	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64eks22	bafyreiahrxynudxg5rk76kw5mbcr65gjuli76szgmm3m3bso6ewxtkyngq	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64eks22	bafyreiahrxynudxg5rk76kw5mbcr65gjuli76szgmm3m3bso6ewxtkyngq	2022-07-15T00:48:23.914Z	2024-06-07T12:43:09.827Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7mcqk22	bafyreibc6lqv5cla3g6xfubafiwapmfzvgbakgfwgcwcjkiwpaj4wyooqm	did:plc:awpz77o4dyluwpa2j2p2oqgs	a/s/l?	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22	bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22	bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4	2022-07-15T00:48:28.914Z	2024-06-07T12:43:09.934Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7of5k22	bafyreibjpq4ipgtmol5ckai6544ipyqmvevvjakzc4x46ac3jhfyrm7gfy	did:plc:zluht54hsscg6octtayzd3ft	ugh when will hashtags get supported in this app	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7aby222	bafyreicwdnl52rm2basxdhgvcwvmac6iesq34njgbbschzx4usgzsf42ei	2022-07-15T00:48:31.914Z	2024-06-07T12:43:10.001Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7qglc22	bafyreiduw3nbbzfjcxoa37imhi5qtdkjr2bkxgq6k4srpwpab6zpgcxlqm	did:plc:5ssevsxo3qyovxpgkg3n2tfs	This is sort of accurate, but honestly it misses a huge part of the issue at hand. There are just so many factors and I don't think a vibe is enough to cover it.	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6uky222	bafyreidokrfnhzk5mnwcicnvw7cuorg2qgnpotk2vicwcuhxeua2cxwur4	2022-07-15T00:48:34.914Z	2024-06-07T12:43:10.069Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7uank22	bafyreigb5ssh4mbqyaylhacmzhnt6oiltbpirhmqazmtbpswbfbysflgn4	did:plc:awpz77o4dyluwpa2j2p2oqgs	fire	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22	bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6zbek22	bafyreibs7cdwlfhlykogfpj5yimdk62ttoq5gn4akjk65zykistm4pk7cy	2022-07-15T00:48:40.914Z	2024-06-07T12:43:10.194Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7vjo222	bafyreif3qimkdrmai7smpokzs7u5tx6uuwvf22xta7rvijwtcxyi2rao64	did:plc:zluht54hsscg6octtayzd3ft	is it cool if I DM?	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm63k7222	bafyreidwwfbydjpoh5pm363uhfzdejxsuutwm4cpsv2ptht4x5q5ug22by	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6m2jc22	bafyreigfwyy5uw74g2gkfilquplidccubgxpvdihuvwjnkag2iogetp5fu	2022-07-15T00:48:42.914Z	2024-06-07T12:43:10.237Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6sar222	bafyreih5bwjxfretqbmnmtnh2nmfoxrugkrsydmgo73izz26k64mxtxshy	did:plc:awpz77o4dyluwpa2j2p2oqgs	lol	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22	bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6p55k22	bafyreid2w2wi55ko3m3lcj6puvrywdcfey2dapgg2raddqvcjq5jxkw6be	2022-07-15T00:47:50.914Z	2024-06-07T12:43:09.081Z	\N	t	f	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6p55k22	bafyreid2w2wi55ko3m3lcj6puvrywdcfey2dapgg2raddqvcjq5jxkw6be	did:plc:zluht54hsscg6octtayzd3ft	ugh when will hashtags get supported in this app	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22	bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22	bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4	2022-07-15T00:47:45.914Z	2024-06-07T12:43:08.977Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xaw222	bafyreiaip7e3kif6rhhvkx4dckwbm3egog6sn7kkf4x5e2puj6d4lkit2m	did:plc:awpz77o4dyluwpa2j2p2oqgs	lol	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22	bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6twhs22	bafyreiazf5m4p3ly542yppowxjctwxq6bo7wqn3vxhwlw4zf6gafagjdmi	2022-07-15T00:47:57.914Z	2024-06-07T12:43:09.243Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm72ncs22	bafyreifsu7lckdjbk6tunuxynocyxwfcwafnjsysnyjqtxpse53jj3eyru	did:plc:awpz77o4dyluwpa2j2p2oqgs	ugh when will hashtags get supported in this app	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22	bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22	bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e	2022-07-15T00:48:02.914Z	2024-06-07T12:43:09.355Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm73bt222	bafyreih3vtpmaliuufzvmvp2xh74kgwpnnam7axm3c24o6besdvqzg3bg4	did:plc:awpz77o4dyluwpa2j2p2oqgs	This is sort of accurate, but honestly it misses a huge part of the issue at hand. There are just so many factors and I don't think a vibe is enough to cover it.	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22	bafyreifsazs5bwjay324fnkz5ecluwy4bpehh5iwdkwmerj7ywhjj7pcnq	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22	bafyreifsazs5bwjay324fnkz5ecluwy4bpehh5iwdkwmerj7ywhjj7pcnq	2022-07-15T00:48:03.914Z	2024-06-07T12:43:09.376Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm73ues22	bafyreigntykfl6qep45vt6wq46qrs7huq5opddpw5z2glomc24p2mdfjty	did:plc:awpz77o4dyluwpa2j2p2oqgs	Wow, so true!	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22	bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22	bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu	2022-07-15T00:48:04.914Z	2024-06-07T12:43:09.395Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm76di222	bafyreict3zjalmndopvzm4rd5nzx2lz3spqnphfzifmoz7f3odke2jqptq	did:plc:zluht54hsscg6octtayzd3ft	What does this mean for pet owners in the midterms?	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22	bafyreicyq7eldus5jwjulcgmbijfzkiqyfbnoo74fmowj5n2ydxqc4q7he	2022-07-15T00:48:08.914Z	2024-06-07T12:43:09.485Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7aby222	bafyreicwdnl52rm2basxdhgvcwvmac6iesq34njgbbschzx4usgzsf42ei	did:plc:zluht54hsscg6octtayzd3ft	is it cool if I DM?	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6qcb222	bafyreideidtqpviy6deov3hiv2bph4ngud6snrf3rqj62e7n56me3accuy	2022-07-15T00:48:10.914Z	2024-06-07T12:43:09.541Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7dqdc22	bafyreig63wu7skovixex2waesavh2ifjmbxbgohfggaag35kkmovwh2u7u	did:plc:5ssevsxo3qyovxpgkg3n2tfs	What does this mean for pet owners in the midterms?	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22	bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xaw222	bafyreiaip7e3kif6rhhvkx4dckwbm3egog6sn7kkf4x5e2puj6d4lkit2m	2022-07-15T00:48:15.914Z	2024-06-07T12:43:09.652Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7eetk22	bafyreicktcft44xal23bti6zihdlbldfrjii7r3zuro5djfbdmmrle5rem	did:plc:5ssevsxo3qyovxpgkg3n2tfs	lol	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6qcb222	bafyreideidtqpviy6deov3hiv2bph4ngud6snrf3rqj62e7n56me3accuy	2022-07-15T00:48:16.914Z	2024-06-07T12:43:09.673Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7exfc22	bafyreidc3o4sc4xts5dchqstdesgsca2nwtmgjl3ipbtef47bludcr6wry	did:plc:zluht54hsscg6octtayzd3ft	Haha ikr	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6cnqc22	bafyreid273gys3wrzpedo7uguxwxq6c5iqyji63uqrbxq7xd2v5645rrja	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6cnqc22	bafyreid273gys3wrzpedo7uguxwxq6c5iqyji63uqrbxq7xd2v5645rrja	2022-07-15T00:48:17.914Z	2024-06-07T12:43:09.693Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7hles22	bafyreiat6kavehlet5nmwsgctjpeukavhtkalikajn54efgle2mmv2opzu	did:plc:awpz77o4dyluwpa2j2p2oqgs	fire	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6qxqk22	bafyreigytipb36mr5photttbnc7yrmy75tnwvcvohx3kg56vod5n522slq	2022-07-15T00:48:21.914Z	2024-06-07T12:43:09.781Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7jpqc22	bafyreiarkx6bnx7jvqoqbq7aozirex5v2356rf2zztbuuwxxfnn7ibqoly	did:plc:zluht54hsscg6octtayzd3ft	Wow, so true!	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6qxqk22	bafyreigytipb36mr5photttbnc7yrmy75tnwvcvohx3kg56vod5n522slq	2022-07-15T00:48:24.914Z	2024-06-07T12:43:09.848Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7s6ak22	bafyreiaccvsbkagfya76xdapjcg7ifgmt5fqew4sljcptcbqdlso3rkqpy	did:plc:awpz77o4dyluwpa2j2p2oqgs	lol	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22	bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6twhs22	bafyreiazf5m4p3ly542yppowxjctwxq6bo7wqn3vxhwlw4zf6gafagjdmi	2022-07-15T00:48:37.914Z	2024-06-07T12:43:10.127Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6uky222	bafyreidokrfnhzk5mnwcicnvw7cuorg2qgnpotk2vicwcuhxeua2cxwur4	did:plc:zluht54hsscg6octtayzd3ft	ugh when will hashtags get supported in this app	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6pppc22	bafyreibd6kqdmg5bvqvfme3nu76crz5hpdygbuvtfo5z6gmn73pm23c4bi	2022-07-15T00:47:53.914Z	2024-06-07T12:43:09.155Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xxes22	bafyreidqo3vj5ry5kvsm4srfutz27dtzkmqdzcq7sxouhcmxslcybcqf4m	did:plc:awpz77o4dyluwpa2j2p2oqgs	Wow, so true!	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22	bafyreifsazs5bwjay324fnkz5ecluwy4bpehh5iwdkwmerj7ywhjj7pcnq	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22	bafyreifsazs5bwjay324fnkz5ecluwy4bpehh5iwdkwmerj7ywhjj7pcnq	2022-07-15T00:47:58.914Z	2024-06-07T12:43:09.268Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6yoss22	bafyreifet3tq7lfikiwmcbp4puqxs5vl35otyg4skzvqdjjtq75juzazxq	did:plc:awpz77o4dyluwpa2j2p2oqgs	fire	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22	bafyreifsazs5bwjay324fnkz5ecluwy4bpehh5iwdkwmerj7ywhjj7pcnq	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xxes22	bafyreidqo3vj5ry5kvsm4srfutz27dtzkmqdzcq7sxouhcmxslcybcqf4m	2022-07-15T00:47:59.914Z	2024-06-07T12:43:09.290Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm74zic22	bafyreibom4ih33aggpyno5jlmjlaxjybicxr3wcotkmaf4xqila67dnhhu	did:plc:5ssevsxo3qyovxpgkg3n2tfs	fire	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22	bafyreifsazs5bwjay324fnkz5ecluwy4bpehh5iwdkwmerj7ywhjj7pcnq	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm73bt222	bafyreih3vtpmaliuufzvmvp2xh74kgwpnnam7axm3c24o6besdvqzg3bg4	2022-07-15T00:48:06.914Z	2024-06-07T12:43:09.432Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7awic22	bafyreie5deuo4q3cbbfcms72ew3fhnpljyclzrqfc7ybathfcj54lyqu4e	did:plc:awpz77o4dyluwpa2j2p2oqgs	This is sort of accurate, but honestly it misses a huge part of the issue at hand. There are just so many factors and I don't think a vibe is enough to cover it.	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm66hx222	bafyreidxjakkbifqysatmszjyvoa3usbnenyadx2dvxhebektepcvu4hry	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm66hx222	bafyreidxjakkbifqysatmszjyvoa3usbnenyadx2dvxhebektepcvu4hry	2022-07-15T00:48:11.914Z	2024-06-07T12:43:09.563Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7cbhc22	bafyreiczpp4iuoulzhklxt5adsz7eamtxr5pq45bnm2g4pa2opidgc2r3u	did:plc:awpz77o4dyluwpa2j2p2oqgs	is it cool if I DM?	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22	bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22	bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e	2022-07-15T00:48:13.914Z	2024-06-07T12:43:09.607Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7czuk22	bafyreigjauenhx5xcfji4c6sw7ghv2nz2p2yz4alespogrf7r7l5nexazq	did:plc:zluht54hsscg6octtayzd3ft	fire	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6v7ic22	bafyreihafcvgqpktxi7ugcwgfru5pm77due6skn6gkkqdq7jw7uodnzwxy	2022-07-15T00:48:14.914Z	2024-06-07T12:43:09.631Z	\N	t	f	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7gafs22	bafyreibw5y2w5tkkh3lwespoggcetavx2pmxnm6owicueqocrppxeftokq	did:plc:zluht54hsscg6octtayzd3ft	lol	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by	2022-07-15T00:48:19.914Z	2024-06-07T12:43:09.735Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7mz7c22	bafyreid5ptmaadcgwqbehrtblhngprsk6dg2jwmc2j3zosfq7rdn57ztcy	did:plc:zluht54hsscg6octtayzd3ft	Wow, so true!	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7jpqc22	bafyreiarkx6bnx7jvqoqbq7aozirex5v2356rf2zztbuuwxxfnn7ibqoly	2022-07-15T00:48:29.914Z	2024-06-07T12:43:09.959Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma227222	bafyreiezftduzsjzbgjfyxkli3vbre3jybpgkilyvpfnhfoxfjthry3byy	did:plc:5ssevsxo3qyovxpgkg3n2tfs	a/s/l?	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6bhnk22	bafyreiceit7gbs5xammejxeej665pnliyxyogmf4fqkvmakundsmd7mooe	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6bhnk22	bafyreiceit7gbs5xammejxeej665pnliyxyogmf4fqkvmakundsmd7mooe	2022-07-15T00:48:48.914Z	2024-06-07T12:43:10.385Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma2qns22	bafyreidnyqv4p7iwm2tuoi7pfhkqpa3qwwwjsubu6tjxzwianersoc22qi	did:plc:zluht54hsscg6octtayzd3ft	fire	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6uky222	bafyreidokrfnhzk5mnwcicnvw7cuorg2qgnpotk2vicwcuhxeua2cxwur4	2022-07-15T00:48:49.914Z	2024-06-07T12:43:10.408Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmab2sk22	bafyreifwkhtulxci2yl7bbiq5u4gs2d34ldi5o73svdvakfknp4g73ula4	did:plc:awpz77o4dyluwpa2j2p2oqgs	is it cool if I DM?	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22	bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7rkpk22	bafyreifl3toeqtvxgbdmp6ov6mcxxivj2entj66xn4x4kfvpp42m7gqr5q	2022-07-15T00:48:58.914Z	2024-06-07T12:43:10.617Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmacugc22	bafyreigxi6u33zlzunwuosrs73xgn6335oi7p3c4ulzqfedyoqffkt6li4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	Wow, so true!	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm63k7222	bafyreidwwfbydjpoh5pm363uhfzdejxsuutwm4cpsv2ptht4x5q5ug22by	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6m2jc22	bafyreigfwyy5uw74g2gkfilquplidccubgxpvdihuvwjnkag2iogetp5fu	2022-07-15T00:49:00.914Z	2024-06-07T12:43:10.674Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmakqes22	bafyreieqb5mec6ke3bstogsks46ka4hvgop7skmyvwasgigwsb4l4wm6ji	did:plc:5ssevsxo3qyovxpgkg3n2tfs	is it cool if I DM?	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma2qns22	bafyreidnyqv4p7iwm2tuoi7pfhkqpa3qwwwjsubu6tjxzwianersoc22qi	2022-07-15T00:49:10.914Z	2024-06-07T12:43:10.934Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7tm5c22	bafyreidvpfwzrp7zlftziynbgybw2d5vh36yirkrtvwollweu7o2i4l4ki	did:plc:5ssevsxo3qyovxpgkg3n2tfs	lol	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22	bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22	bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm	2022-07-15T00:48:39.914Z	2024-06-07T12:43:10.175Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7wtns22	bafyreihgh57cwdh3kywwadabvhnfpfrsvhmuugl5otz4xfsgsja7uhv2qm	did:plc:awpz77o4dyluwpa2j2p2oqgs	This is sort of accurate, but honestly it misses a huge part of the issue at hand. There are just so many factors and I don't think a vibe is enough to cover it.	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22	bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6zuvk22	bafyreihjmjhi6ovt77ffrwdttf4m2xmfi6ug5wczn2xccetuw2nj2racd4	2022-07-15T00:48:44.914Z	2024-06-07T12:43:10.280Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma3k2c22	bafyreiaw2qpwzp6x6jlx5rzzknelrsajqi2titcwmji625na6xcglyiv4q	did:plc:zluht54hsscg6octtayzd3ft	This is sort of accurate, but honestly it misses a huge part of the issue at hand. There are just so many factors and I don't think a vibe is enough to cover it.	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6t62k22	bafyreia4smzotwpndfww2bxdmhqgovxq7pas5klmjwg2czsx2z6cv56e6m	2022-07-15T00:48:50.914Z	2024-06-07T12:43:10.432Z	\N	t	f	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma6pmc22	bafyreicocopqz3vmrs7ndsx7l7rnph3sqpdoshml7f6vx4m2klvzkjpa24	did:plc:5ssevsxo3qyovxpgkg3n2tfs	fire	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22	bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7mcqk22	bafyreibc6lqv5cla3g6xfubafiwapmfzvgbakgfwgcwcjkiwpaj4wyooqm	2022-07-15T00:48:55.914Z	2024-06-07T12:43:10.539Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmaa4js22	bafyreiad2yqm6qwrpshalzscz644qp3osayprmcddvhwo2dywiqffrm2bi	did:plc:5ssevsxo3qyovxpgkg3n2tfs	Wow, so true!	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22	bafyreicwid24ntku3kmqruypwpgsdkpanhg2emvdvbkuvn3fmppxzlhdqa	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma5enc22	bafyreifhrml2m2oqyue37mn2iwlsirdnpjues76yufy5invzhigguanita	2022-07-15T00:48:57.914Z	2024-06-07T12:43:10.584Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmaeaek22	bafyreihkzh7ny5yrxqemvybg3i7777fj7mfnde6xeyrt4wmxjs5rljgoge	did:plc:zluht54hsscg6octtayzd3ft	is it cool if I DM?	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22	bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6zuvk22	bafyreihjmjhi6ovt77ffrwdttf4m2xmfi6ug5wczn2xccetuw2nj2racd4	2022-07-15T00:49:02.914Z	2024-06-07T12:43:10.719Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmagjmc22	bafyreiapglbozxgvrngr3i56brbaukc5udsdbwsmmp7axguqscbtavuz6m	did:plc:5ssevsxo3qyovxpgkg3n2tfs	is it cool if I DM?	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22	bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6sar222	bafyreih5bwjxfretqbmnmtnh2nmfoxrugkrsydmgo73izz26k64mxtxshy	2022-07-15T00:49:05.914Z	2024-06-07T12:43:10.796Z	\N	t	f	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmamvpk22	bafyreigzm756fmbrj22rhawr7cojojnc7g3bu32rzjw6armvhpfjvvkgz4	did:plc:awpz77o4dyluwpa2j2p2oqgs	ugh when will hashtags get supported in this app	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22	bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmagjmc22	bafyreiapglbozxgvrngr3i56brbaukc5udsdbwsmmp7axguqscbtavuz6m	2022-07-15T00:49:13.914Z	2024-06-07T12:43:11.003Z	\N	t	f	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7wa4s22	bafyreiajzithxxyp3pm5rzwxs4iz6ej4nfo7jj5y3uk77nxfd4o5hxjgza	did:plc:zluht54hsscg6octtayzd3ft	lol	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6v7ic22	bafyreihafcvgqpktxi7ugcwgfru5pm77due6skn6gkkqdq7jw7uodnzwxy	2022-07-15T00:48:43.914Z	2024-06-07T12:43:10.259Z	\N	t	f	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7ymcc22	bafyreicdlrtocb5hivmgg5vfcas2bypsrk64dehthoqhjmkvl64o6kpgqy	did:plc:zluht54hsscg6octtayzd3ft	a/s/l?	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6t62k22	bafyreia4smzotwpndfww2bxdmhqgovxq7pas5klmjwg2czsx2z6cv56e6m	2022-07-15T00:48:46.914Z	2024-06-07T12:43:10.339Z	\N	t	f	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkma5z5k22	bafyreidtr62xflznx7wov2vsnlzhrosvckdvf4wxcxelae6psf45js2g7m	did:plc:awpz77o4dyluwpa2j2p2oqgs	is it cool if I DM?	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22	bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7dqdc22	bafyreig63wu7skovixex2waesavh2ifjmbxbgohfggaag35kkmovwh2u7u	2022-07-15T00:48:54.914Z	2024-06-07T12:43:10.513Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma4s3k22	bafyreih6ycrwvvvewm65opmzr2w2bgbfza4o674talhlcddpixp5mf6mv4	did:plc:zluht54hsscg6octtayzd3ft	Wow, so true!	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22	bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22	bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm	2022-07-15T00:48:52.914Z	2024-06-07T12:43:10.474Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmafobc22	bafyreickokrszbu3fyh7ebesnizvfq627h3hzsh5m2vkyjqqkx2ajidq2m	did:plc:zluht54hsscg6octtayzd3ft	is it cool if I DM?	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6er4k22	bafyreifed7rbzncumo543gdaydnaprdl2aokx725gk6cfruqimwngkfw2e	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6er4k22	bafyreifed7rbzncumo543gdaydnaprdl2aokx725gk6cfruqimwngkfw2e	2022-07-15T00:49:04.914Z	2024-06-07T12:43:10.767Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmaig5s22	bafyreihjk3euvxnwb34irk5rszmtai57cv5zayb6tdffswiljtylv6xu6y	did:plc:awpz77o4dyluwpa2j2p2oqgs	Haha ikr	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22	bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22	bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu	2022-07-15T00:49:07.914Z	2024-06-07T12:43:10.857Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmajvz222	bafyreibcdzdfzu6gp6maiw2aopnyop6njhp4z7s4gtdy4paifyngjcfnze	did:plc:awpz77o4dyluwpa2j2p2oqgs	What does this mean for pet owners in the midterms?	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm5zpm222	bafyreibl6nrxujzusdkawwdxoegdgbysqt3wu7xrpimtyeqij4ldrdpvt4	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm5zpm222	bafyreibl6nrxujzusdkawwdxoegdgbysqt3wu7xrpimtyeqij4ldrdpvt4	2022-07-15T00:49:09.914Z	2024-06-07T12:43:10.909Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma5enc22	bafyreifhrml2m2oqyue37mn2iwlsirdnpjues76yufy5invzhigguanita	did:plc:5ssevsxo3qyovxpgkg3n2tfs	This is sort of accurate, but honestly it misses a huge part of the issue at hand. There are just so many factors and I don't think a vibe is enough to cover it.	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22	bafyreicwid24ntku3kmqruypwpgsdkpanhg2emvdvbkuvn3fmppxzlhdqa	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22	bafyreicwid24ntku3kmqruypwpgsdkpanhg2emvdvbkuvn3fmppxzlhdqa	2022-07-15T00:48:53.914Z	2024-06-07T12:43:10.492Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma46kk22	bafyreicgt73gbvybblwvgog63c73uoyvzkiwpflu2zi2dbywpnafz3r7mi	did:plc:zluht54hsscg6octtayzd3ft	ugh when will hashtags get supported in this app	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22	bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7p2n222	bafyreigiqmzmew4cu6eeualqhurezkrtsunelk3hnzpc7ot3o23lhornvq	2022-07-15T00:48:51.914Z	2024-06-07T12:43:10.454Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma7h2c22	bafyreidrqkwmhh2yxhpkbisqufrib2mysgrztuof6s2ur6p7362n5ozk4q	did:plc:5ssevsxo3qyovxpgkg3n2tfs	Wow, so true!	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7wa4s22	bafyreiajzithxxyp3pm5rzwxs4iz6ej4nfo7jj5y3uk77nxfd4o5hxjgza	2022-07-15T00:48:56.914Z	2024-06-07T12:43:10.563Z	\N	t	f	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmac3z222	bafyreiahz6chrakkw7en4ceothts6uyxlualmbsgaaaruneiouc4t4uqa4	did:plc:zluht54hsscg6octtayzd3ft	is it cool if I DM?	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	2022-07-15T00:48:59.914Z	2024-06-07T12:43:10.651Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmaexsk22	bafyreia25f2teavzep54pf5lpmj2c5cstertmc6uzsit6vt72k7bqlb4cm	did:plc:5ssevsxo3qyovxpgkg3n2tfs	is it cool if I DM?	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by	2022-07-15T00:49:03.914Z	2024-06-07T12:43:10.741Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmaj7kc22	bafyreic5guwbepjlbejxy5lpjcmnkjgkbjn5bdtyp3hy6uzr57hyev2ify	did:plc:5ssevsxo3qyovxpgkg3n2tfs	What does this mean for pet owners in the midterms?	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22	bafyreicwid24ntku3kmqruypwpgsdkpanhg2emvdvbkuvn3fmppxzlhdqa	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22	bafyreicwid24ntku3kmqruypwpgsdkpanhg2emvdvbkuvn3fmppxzlhdqa	2022-07-15T00:49:08.914Z	2024-06-07T12:43:10.883Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmam7as22	bafyreidnh6h34yqwjgg65zdxkd35jms6vggpkc3abjojoy2bjcrmbb3f6i	did:plc:zluht54hsscg6octtayzd3ft	Haha ikr	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmac3z222	bafyreiahz6chrakkw7en4ceothts6uyxlualmbsgaaaruneiouc4t4uqa4	2022-07-15T00:49:12.914Z	2024-06-07T12:43:10.980Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmcyojc22	bafyreibp35vdsghs6j6yn6fcmr52tc4qzlab3uklmeev2o5lu5mhvjo5tu	did:plc:zluht54hsscg6octtayzd3ft	check out my algorithm!	\N	\N	\N	\N	2022-07-15T00:51:25.914Z	2024-06-07T12:43:13.488Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmahcys22	bafyreiazaf56e45jmxntxyybs6hvwujxn4t23nf25oa76nzrn43jnlctoy	did:plc:awpz77o4dyluwpa2j2p2oqgs	ugh when will hashtags get supported in this app	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7gafs22	bafyreibw5y2w5tkkh3lwespoggcetavx2pmxnm6owicueqocrppxeftokq	2022-07-15T00:49:06.914Z	2024-06-07T12:43:10.829Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmalis222	bafyreiasu4pjf66p3od3o2mxzct6ivvz43tmghpanlhjnaotmk5hs4pq3y	did:plc:awpz77o4dyluwpa2j2p2oqgs	a/s/l?	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	2022-07-15T00:49:11.914Z	2024-06-07T12:43:10.958Z	\N	\N	\N	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmao7pc22	bafyreiaagbmljfnqkwpppijmq2rc5ld25ohrvvcsyw2ilzbsvz5wqdh5l4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	a/s/l?	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22	bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22	bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu	2022-07-15T00:49:15.914Z	2024-06-07T12:43:11.045Z	\N	\N	\N	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmapzd222	bafyreid3xstgek64pqr2zq6bohxi4vkfqmyr7e4wjsprguho5av3oz4ec4	did:plc:awpz77o4dyluwpa2j2p2oqgs	Haha ikr	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22	bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma4s3k22	bafyreih6ycrwvvvewm65opmzr2w2bgbfza4o674talhlcddpixp5mf6mv4	2022-07-15T00:49:17.914Z	2024-06-07T12:43:11.103Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmd3t4222	bafyreihvhntyj52zza4vxgzqooioxxuzhnxiqyxsijqk4lxgjc6ftoeuue	did:plc:zluht54hsscg6octtayzd3ft	bobs feed is neat too	\N	\N	\N	\N	2022-07-15T00:51:30.914Z	2024-06-07T12:43:13.589Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmanm6c22	bafyreihvzfls3zk4ev6s5p3r6ax3e3rrkhw5njjjb3yggnspydxhvhu7aa	did:plc:zluht54hsscg6octtayzd3ft	lol	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22	bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma6pmc22	bafyreicocopqz3vmrs7ndsx7l7rnph3sqpdoshml7f6vx4m2klvzkjpa24	2022-07-15T00:49:14.914Z	2024-06-07T12:43:11.025Z	\N	\N	\N	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmapbv222	bafyreihth3a7rf7n34zk5dfqnxbaijjey52lznc6sr6xwu7tap7lu65az4	did:plc:zluht54hsscg6octtayzd3ft	ugh when will hashtags get supported in this app	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7wa4s22	bafyreiajzithxxyp3pm5rzwxs4iz6ej4nfo7jj5y3uk77nxfd4o5hxjgza	2022-07-15T00:49:16.914Z	2024-06-07T12:43:11.080Z	\N	t	f	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmaqlus22	bafyreicoh73xyye3txq6ooqie3h5jv62zyt4mu362kvszxkxmczef6xu5u	did:plc:awpz77o4dyluwpa2j2p2oqgs	What does this mean for pet owners in the midterms?	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm66hx222	bafyreidxjakkbifqysatmszjyvoa3usbnenyadx2dvxhebektepcvu4hry	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm66hx222	bafyreidxjakkbifqysatmszjyvoa3usbnenyadx2dvxhebektepcvu4hry	2022-07-15T00:49:18.914Z	2024-06-07T12:43:11.122Z	\N	\N	\N	\N
\.


--
-- Data for Name: post_agg; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.post_agg (uri, "likeCount", "replyCount", "repostCount") FROM stdin;
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6pppc22	1	1	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6zuvk22	0	4	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6p55k22	0	1	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7mcqk22	1	2	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22	0	2	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6lgyc22	3	1	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6er4k22	1	1	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma2qns22	1	1	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22	2	3	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22	0	5	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm63k7222	1	1	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6vszc22	0	1	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6cnqc22	0	1	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6bhnk22	1	1	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6wiis22	1	1	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22	1	4	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6qxqk22	1	3	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	1	3	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22	2	3	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7aby222	0	1	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7l2pc22	0	1	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7cbhc22	0	1	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6twhs22	0	2	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6v7ic22	0	3	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6uky222	0	3	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6t62k22	0	2	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm5zpm222	1	3	1
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7gafs22	1	1	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7p2n222	1	1	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22	1	2	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	3	4	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma5enc22	0	1	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22	0	3	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65frc22	1	0	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64eks22	2	2	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22	2	2	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm66hx222	1	2	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6ax2c22	1	0	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6c27c22	1	0	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6m2jc22	1	3	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ndjs22	3	0	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6qcb222	1	3	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6sar222	1	1	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xxes22	1	1	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xaw222	1	1	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6yoss22	1	0	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6zbek22	1	1	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm73ues22	2	0	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm72ncs22	2	1	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm73bt222	2	1	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm74gwk22	2	0	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm74zic22	3	1	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7dqdc22	1	3	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm75mzc22	2	1	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm76di222	1	0	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7jpqc22	1	2	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7wa4s22	1	2	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7rkpk22	2	1	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmaa4js22	1	1	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma6pmc22	1	1	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma4s3k22	2	1	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmac3z222	1	1	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmagjmc22	1	1	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm77cq222	1	0	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7awic22	2	0	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7gvvc22	1	0	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7keak22	1	0	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7vjo222	1	0	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma7h2c22	1	0	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmamvpk22	1	0	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7blxs22	1	0	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7npo222	2	0	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7pn6s22	1	0	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7sxn222	1	0	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7zepk22	1	0	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmao7pc22	2	0	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmapbv222	2	0	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7czuk22	1	0	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7ihp222	1	0	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7lp7k22	1	0	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7qglc22	1	0	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7qz5222	3	0	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7tm5c22	1	0	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7uw5222	1	0	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7ymcc22	1	0	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma46kk22	1	0	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmab2sk22	1	0	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmaeaek22	1	0	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmaig5s22	2	0	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7eetk22	1	0	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7hles22	2	0	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7j2as22	1	0	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma227222	1	0	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmadluc22	2	0	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmahcys22	2	0	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmaqlus22	2	0	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7mz7c22	1	0	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7of5k22	2	0	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7uank22	2	0	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7wtns22	1	0	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkma5z5k22	1	0	0
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmaexsk22	1	0	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmalis222	1	0	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmam7as22	1	0	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmajvz222	2	0	0
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmapzd222	2	0	0
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.generator/alice-favs	3	0	0
\.


--
-- Data for Name: post_embed_external; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.post_embed_external ("postUri", uri, title, description, "thumbCid") FROM stdin;
\.


--
-- Data for Name: post_embed_image; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.post_embed_image ("postUri", "position", "imageCid", alt) FROM stdin;
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6k6x222	0	bafkreidp4fmd27x4qpjxjzvxlun6l5a4zuhkvq4dv4vgjz4hx7wxlrlprq	naughty naughty
\.


--
-- Data for Name: post_embed_record; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.post_embed_record ("postUri", "embedUri", "embedCid") FROM stdin;
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmcyojc22	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.generator/alice-favs	bafyreidysakacrh2omr5ht5zb4xw2w46m7ngjitvefjzjzkt6qo6xjowfq
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmd3t4222	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.generator/bob-redux	bafyreibwqt7zwvetxo2tbjdgcgo2gbjjppyce7by46tvagdtu2kze26i5a
\.


--
-- Data for Name: profile; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.profile (uri, cid, creator, "displayName", description, "avatarCid", "bannerCid", "indexedAt") FROM stdin;
at://did:plc:bvvapistf6rfov6ptfsomeai/app.bsky.actor.profile/self	bafyreihxeexyqegnks2kycb3asqr7jlj7jixffzno22dwzwp46va4kkrzu	did:plc:bvvapistf6rfov6ptfsomeai	Dev-env Moderation	The pretend version of mod.bsky.app	\N	\N	2024-06-07T12:43:06.538Z
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.actor.profile/self	bafyreigzqz2bekw3x2y3tyt6k5yyy7uatchuwdxn56tfr4stctkhefq3e4	did:plc:zluht54hsscg6octtayzd3ft	Alice	Test user 1	\N	\N	2024-06-07T12:43:07.521Z
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.actor.profile/self	bafyreiaf44ydatvikgcjje4pfgdpkv75a7xut6znqvxxutiryrm45lokqu	did:plc:5ssevsxo3qyovxpgkg3n2tfs	Bob	Test user 3	\N	\N	2024-06-07T12:43:07.631Z
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.actor.profile/self	bafyreianhu4d3ic25anvn5t5ghzpi5rqleobsks5pfo2o6yvk36b4zamqe	did:plc:awpz77o4dyluwpa2j2p2oqgs	Carla	Test user 5	\N	\N	2024-06-07T12:43:07.731Z
at://did:plc:vb63kualusarrqqejvolrrv7/app.bsky.actor.profile/self	bafyreif23tsmsrb5cvcojficzobr57lbc4ilf4xmzegf7hexnzeggmpz3q	did:plc:vb63kualusarrqqejvolrrv7	Test Labeler	Labeling things across the atmosphere	\N	\N	2024-06-07T12:43:13.693Z
\.


--
-- Data for Name: profile_agg; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.profile_agg (did, "followersCount", "followsCount", "postsCount") FROM stdin;
did:plc:5ssevsxo3qyovxpgkg3n2tfs	2	2	36
did:plc:awpz77o4dyluwpa2j2p2oqgs	2	2	41
did:plc:zluht54hsscg6octtayzd3ft	2	2	46
\.


--
-- Data for Name: record; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.record (uri, cid, did, json, "indexedAt", "takedownRef") FROM stdin;
at://did:plc:bvvapistf6rfov6ptfsomeai/app.bsky.actor.profile/self	bafyreihxeexyqegnks2kycb3asqr7jlj7jixffzno22dwzwp46va4kkrzu	did:plc:bvvapistf6rfov6ptfsomeai	{"$type":"app.bsky.actor.profile","description":"The pretend version of mod.bsky.app","displayName":"Dev-env Moderation"}	2024-06-07T12:43:06.538Z	\N
at://did:plc:bvvapistf6rfov6ptfsomeai/app.bsky.labeler.service/self	bafyreibtfmdstlnokwsgxhtkmjgrls6gd5wrrn2pkijrfg4f7rb37r2kfq	did:plc:bvvapistf6rfov6ptfsomeai	{"$type":"app.bsky.labeler.service","policies":{"labelValues":["!hide","!warn","porn","sexual","nudity","sexual-figurative","graphic-media","self-harm","sensitive","extremist","intolerant","threat","rude","illicit","security","unsafe-link","impersonation","misinformation","scam","engagement-farming","spam","rumor","misleading","inauthentic"],"labelValueDefinitions":[{"blurs":"content","locales":[{"lang":"en","name":"Spam","description":"Unwanted, repeated, or unrelated actions that bother users."}],"severity":"inform","adultOnly":false,"identifier":"spam","defaultSetting":"hide"},{"blurs":"none","locales":[{"lang":"en","name":"Impersonation","description":"Pretending to be someone else without permission."}],"severity":"inform","adultOnly":false,"identifier":"impersonation","defaultSetting":"hide"},{"blurs":"content","locales":[{"lang":"en","name":"Scam","description":"Scams, phishing & fraud."}],"severity":"alert","adultOnly":false,"identifier":"scam","defaultSetting":"hide"},{"blurs":"content","locales":[{"lang":"en","name":"Intolerance","description":"Discrimination against protected groups."}],"severity":"alert","adultOnly":false,"identifier":"intolerant","defaultSetting":"warn"},{"blurs":"content","locales":[{"lang":"en","name":"Self-Harm","description":"Promotes self-harm, including graphic images, glorifying discussions, or triggering stories."}],"severity":"alert","adultOnly":false,"identifier":"self-harm","defaultSetting":"warn"},{"blurs":"content","locales":[{"lang":"en","name":"Security Concerns","description":"May be unsafe and could harm your device, steal your info, or get your account hacked."}],"severity":"alert","adultOnly":false,"identifier":"security","defaultSetting":"hide"},{"blurs":"content","locales":[{"lang":"en","name":"Misleading","description":"Altered images/videos, deceptive links, or false statements."}],"severity":"alert","adultOnly":false,"identifier":"misleading","defaultSetting":"warn"},{"blurs":"content","locales":[{"lang":"en","name":"Threats","description":"Promotes violence or harm towards others, including threats, incitement, or advocacy of harm."}],"severity":"inform","adultOnly":false,"identifier":"threat","defaultSetting":"hide"},{"blurs":"content","locales":[{"lang":"en","name":"Unsafe link","description":"Links to harmful sites with malware, phishing, or violating content that risk security and privacy."}],"severity":"alert","adultOnly":false,"identifier":"unsafe-link","defaultSetting":"hide"},{"blurs":"content","locales":[{"lang":"en","name":"Illicit","description":"Promoting or selling potentially illicit goods, services, or activities."}],"severity":"alert","adultOnly":false,"identifier":"illicit","defaultSetting":"hide"},{"blurs":"content","locales":[{"lang":"en","name":"Misinformation","description":"Spreading false or misleading info, including unverified claims and harmful conspiracy theories."}],"severity":"inform","adultOnly":false,"identifier":"misinformation","defaultSetting":"warn"},{"blurs":"content","locales":[{"lang":"en","name":"Rumor","description":"Approach with caution, as these claims lack evidence from credible sources."}],"severity":"inform","adultOnly":false,"identifier":"rumor","defaultSetting":"warn"},{"blurs":"content","locales":[{"lang":"en","name":"Rude","description":"Rude or impolite, including crude language and disrespectful comments, without constructive purpose."}],"severity":"inform","adultOnly":false,"identifier":"rude","defaultSetting":"hide"},{"blurs":"content","locales":[{"lang":"en","name":"Extremist","description":"Radical views advocating violence, hate, or discrimination against individuals or groups."}],"severity":"alert","adultOnly":false,"identifier":"extremist","defaultSetting":"hide"},{"blurs":"content","locales":[{"lang":"en","name":"Sensitive","description":"May be upsetting, covering topics like substance abuse or mental health issues, cautioning sensitive viewers."}],"severity":"alert","adultOnly":false,"identifier":"sensitive","defaultSetting":"warn"},{"blurs":"content","locales":[{"lang":"en","name":"Engagement Farming","description":"Insincere content or bulk actions aimed at gaining followers, including frequent follows, posts, and likes."}],"severity":"alert","adultOnly":false,"identifier":"engagement-farming","defaultSetting":"hide"},{"blurs":"content","locales":[{"lang":"en","name":"Inauthentic Account","description":"Bot or a person pretending to be someone else."}],"severity":"alert","adultOnly":false,"identifier":"inauthentic","defaultSetting":"hide"},{"blurs":"media","locales":[{"lang":"en","name":"Sexually Suggestive (Cartoon)","description":"Art with explicit or suggestive sexual themes, including provocative imagery or partial nudity."}],"severity":"none","adultOnly":true,"identifier":"sexual-figurative","defaultSetting":"show"}]},"createdAt":"2024-06-07T12:43:06.540Z"}	2024-06-07T12:43:06.563Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.actor.profile/self	bafyreigzqz2bekw3x2y3tyt6k5yyy7uatchuwdxn56tfr4stctkhefq3e4	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.actor.profile","website":"www.blueskytest2.com","description":"Test user 1","displayName":"Alice"}	2024-06-07T12:43:07.521Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.actor.profile/self	bafyreiaf44ydatvikgcjje4pfgdpkv75a7xut6znqvxxutiryrm45lokqu	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.actor.profile","website":"www.blueskytest4.com","description":"Test user 3","displayName":"Bob"}	2024-06-07T12:43:07.631Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.actor.profile/self	bafyreianhu4d3ic25anvn5t5ghzpi5rqleobsks5pfo2o6yvk36b4zamqe	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.actor.profile","website":"www.blueskytest6.com","description":"Test user 5","displayName":"Carla"}	2024-06-07T12:43:07.731Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.graph.follow/3kudkm5vhuc22	bafyreifj5ej3fcuh573kjf4u7p6r35erckbijdu72wxrq5rnfb7uof7yyu	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.graph.follow","subject":"did:plc:zluht54hsscg6octtayzd3ft","createdAt":"2022-07-15T00:47:13.914Z"}	2024-06-07T12:43:08.138Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.graph.follow/3kudkm5uimc22	bafyreiexnx6mlny6ejitqpq6pmgzmmudlwnjv4leiyzseqi2ftlsyhr5xe	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.graph.follow","subject":"did:plc:5ssevsxo3qyovxpgkg3n2tfs","createdAt":"2022-07-15T00:47:11.914Z"}	2024-06-07T12:43:08.106Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.graph.follow/3kudkm5wkzc22	bafyreienbm2q5mu7n4dogfc5orrzwdcqk2wdfzgmtbzs4xxc5vvy43gu4q	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.graph.follow","subject":"did:plc:zluht54hsscg6octtayzd3ft","createdAt":"2022-07-15T00:47:15.914Z"}	2024-06-07T12:43:08.173Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.graph.follow/3kudkm5uxb222	bafyreigbxvp7wtwgo26ljetfqsngijk2e2ko744i4uyy36xgs7hh624u7y	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.graph.follow","subject":"did:plc:awpz77o4dyluwpa2j2p2oqgs","createdAt":"2022-07-15T00:47:12.914Z"}	2024-06-07T12:43:08.122Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.graph.follow/3kudkm5x5l222	bafyreidjrfcbto7z7owmtpeyvs7lifd6ljwtocx5mmbajdfonlk6mv5hyu	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.graph.follow","subject":"did:plc:5ssevsxo3qyovxpgkg3n2tfs","createdAt":"2022-07-15T00:47:16.914Z"}	2024-06-07T12:43:08.194Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.graph.follow/3kudkm5vzgs22	bafyreie7m5mbj46oiwd56pvlhsvszlhkqtrst65ssn3hfncjv3g5zfylm4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.graph.follow","subject":"did:plc:awpz77o4dyluwpa2j2p2oqgs","createdAt":"2022-07-15T00:47:14.914Z"}	2024-06-07T12:43:08.156Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}	2024-06-07T12:43:08.217Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm5zpm222	bafyreibl6nrxujzusdkawwdxoegdgbysqt3wu7xrpimtyeqij4ldrdpvt4	did:plc:zluht54hsscg6octtayzd3ft	{"text":"I am serious...and don't call me Shirley.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:18.914Z"}	2024-06-07T12:43:08.276Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22	bafyreicwid24ntku3kmqruypwpgsdkpanhg2emvdvbkuvn3fmppxzlhdqa	did:plc:zluht54hsscg6octtayzd3ft	{"text":"Looks like I picked the wrong week to quit smoking.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:19.914Z"}	2024-06-07T12:43:08.290Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm63k7222	bafyreidwwfbydjpoh5pm363uhfzdejxsuutwm4cpsv2ptht4x5q5ug22by	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"Looks like I picked the wrong week to quit drinking.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:20.914Z"}	2024-06-07T12:43:08.334Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22	bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"Looks like I picked the wrong week to quit amphetamines.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:21.914Z"}	2024-06-07T12:43:08.348Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64eks22	bafyreiahrxynudxg5rk76kw5mbcr65gjuli76szgmm3m3bso6ewxtkyngq	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"Looks like I picked the wrong week to quit sniffing glue.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:22.914Z"}	2024-06-07T12:43:08.361Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65frc22	bafyreidwj4haslqlsrycp5uc2kaoupd5vbgaoxzsxzbwwydcguec4catcu	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"Ladies and gentlemen, this is your stewardess speaking... We regret any inconvenience the sudden cabin movement might have caused, and we hope you enjoy the rest of your flight... By the way, is there anyone on board who knows how to fly a plane? ","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:24.914Z"}	2024-06-07T12:43:08.397Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm66hx222	bafyreidxjakkbifqysatmszjyvoa3usbnenyadx2dvxhebektepcvu4hry	did:plc:zluht54hsscg6octtayzd3ft	{"text":"These people need to go to a hospital.\\nWhat is it?\\nIt's a big place where sick people go, but that's not important right now.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:26.914Z"}	2024-06-07T12:43:08.433Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22	bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}	2024-06-07T12:43:08.381Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6er4k22	bafyreifed7rbzncumo543gdaydnaprdl2aokx725gk6cfruqimwngkfw2e	did:plc:zluht54hsscg6octtayzd3ft	{"text":"The life of everyone on board depends upon just one thing: finding someone back there who can not only fly this plane, but who didn't have fish for dinner.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:35.914Z"}	2024-06-07T12:43:08.637Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22	bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}	2024-06-07T12:43:08.586Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.repost/3kudkm6e6ks22	bafyreihkqndhv2u3jpzos2uiugmuylwfe33x6zmqnq4x47y2hf7d4cmuoe	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.repost","subject":{"cid":"bafyreibl6nrxujzusdkawwdxoegdgbysqt3wu7xrpimtyeqij4ldrdpvt4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm5zpm222"},"createdAt":"2022-07-15T00:47:34.914Z"}	2024-06-07T12:43:08.619Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22	bafyreifsazs5bwjay324fnkz5ecluwy4bpehh5iwdkwmerj7ywhjj7pcnq	did:plc:zluht54hsscg6octtayzd3ft	{"text":"Shanna, they bought their tickets, they knew what they were getting into. I say, let 'em crash.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:36.914Z"}	2024-06-07T12:43:08.756Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6lgyc22	bafyreiarenp2r55zrv52fnig3wyttvdcluenvbu2m3oqte7qn4js54f5dq	did:plc:zluht54hsscg6octtayzd3ft	{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}}},"createdAt":"2022-07-15T00:47:39.914Z"}	2024-06-07T12:43:08.857Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ndjs22	bafyreibbfl3v22jf4vneuwi3wy73d3t2xnqdc4cnb6dqhh4oxwqf6xuxsm	did:plc:zluht54hsscg6octtayzd3ft	{"text":"What does this mean for pet owners in the midterms?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}},"parent":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}}},"createdAt":"2022-07-15T00:47:42.914Z"}	2024-06-07T12:43:08.919Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6qcb222	bafyreideidtqpviy6deov3hiv2bph4ngud6snrf3rqj62e7n56me3accuy	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"This is sort of accurate, but honestly it misses a huge part of the issue at hand. There are just so many factors and I don't think a vibe is enough to cover it.","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreicyq7eldus5jwjulcgmbijfzkiqyfbnoo74fmowj5n2ydxqc4q7he","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22","value":{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}}},"createdAt":"2022-07-15T00:47:41.914Z"}}},"createdAt":"2022-07-15T00:47:47.914Z"}	2024-06-07T12:43:09.016Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6qxqk22	bafyreigytipb36mr5photttbnc7yrmy75tnwvcvohx3kg56vod5n522slq	did:plc:zluht54hsscg6octtayzd3ft	{"text":"is it cool if I DM?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreicyq7eldus5jwjulcgmbijfzkiqyfbnoo74fmowj5n2ydxqc4q7he","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22","value":{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}}},"createdAt":"2022-07-15T00:47:41.914Z"}}},"createdAt":"2022-07-15T00:47:48.914Z"}	2024-06-07T12:43:09.039Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmb24ks22	bafyreiahh4xmqyp3tz7m67da4he2666fbsfnkm3x6gws7z4heveto6soba	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiajg2rg4ysiluze35qqjdymgc7sy34ovwssevuqpvxvxozsodocp4","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6c27c22"},"createdAt":"2022-07-15T00:49:36.914Z"}	2024-06-07T12:43:11.434Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22	bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}	2024-06-07T12:43:08.415Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22	bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"I just want to tell you both good luck. We're all counting on you.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:27.914Z"}	2024-06-07T12:43:08.451Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6ax2c22	bafyreicphr7ig7gn4uabxqoocganwhi5njug2flpfc2m4ggdirmgiu5glq	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"Joey, do you like movies about gladiators?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:28.914Z"}	2024-06-07T12:43:08.514Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6bhnk22	bafyreiceit7gbs5xammejxeej665pnliyxyogmf4fqkvmakundsmd7mooe	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"Captain, maybe we ought to turn on the searchlights now.\\nNo… that’s just what they’ll be expecting us to do.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:29.914Z"}	2024-06-07T12:43:08.533Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6m2jc22	bafyreigfwyy5uw74g2gkfilquplidccubgxpvdihuvwjnkag2iogetp5fu	did:plc:zluht54hsscg6octtayzd3ft	{"text":"Wen token","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreidwwfbydjpoh5pm363uhfzdejxsuutwm4cpsv2ptht4x5q5ug22by","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm63k7222","value":{"text":"Looks like I picked the wrong week to quit drinking.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:20.914Z"}},"parent":{"cid":"bafyreidwwfbydjpoh5pm363uhfzdejxsuutwm4cpsv2ptht4x5q5ug22by","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm63k7222","value":{"text":"Looks like I picked the wrong week to quit drinking.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:20.914Z"}}},"createdAt":"2022-07-15T00:47:40.914Z"}	2024-06-07T12:43:08.877Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22	bafyreicyq7eldus5jwjulcgmbijfzkiqyfbnoo74fmowj5n2ydxqc4q7he	did:plc:zluht54hsscg6octtayzd3ft	{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}}},"createdAt":"2022-07-15T00:47:41.914Z"}	2024-06-07T12:43:08.899Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6pppc22	bafyreibd6kqdmg5bvqvfme3nu76crz5hpdygbuvtfo5z6gmn73pm23c4bi	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"Wen token","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}}},"createdAt":"2022-07-15T00:47:46.914Z"}	2024-06-07T12:43:08.996Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6rna222	bafyreifuxoreut7uuibyzm5wmrl2wefsc4e3ksoeunj4k5fmntrciairi4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"Wen token","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreicwid24ntku3kmqruypwpgsdkpanhg2emvdvbkuvn3fmppxzlhdqa","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22","value":{"text":"Looks like I picked the wrong week to quit smoking.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:19.914Z"}},"parent":{"cid":"bafyreicwid24ntku3kmqruypwpgsdkpanhg2emvdvbkuvn3fmppxzlhdqa","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22","value":{"text":"Looks like I picked the wrong week to quit smoking.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:19.914Z"}}},"createdAt":"2022-07-15T00:47:49.914Z"}	2024-06-07T12:43:09.059Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6twhs22	bafyreiazf5m4p3ly542yppowxjctwxq6bo7wqn3vxhwlw4zf6gafagjdmi	did:plc:zluht54hsscg6octtayzd3ft	{"text":"Wen token","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}},"parent":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}}},"createdAt":"2022-07-15T00:47:52.914Z"}	2024-06-07T12:43:09.135Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6zbek22	bafyreibs7cdwlfhlykogfpj5yimdk62ttoq5gn4akjk65zykistm4pk7cy	did:plc:zluht54hsscg6octtayzd3ft	{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}},"parent":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}}},"createdAt":"2022-07-15T00:48:00.914Z"}	2024-06-07T12:43:09.310Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7czuk22	bafyreigjauenhx5xcfji4c6sw7ghv2nz2p2yz4alespogrf7r7l5nexazq	did:plc:zluht54hsscg6octtayzd3ft	{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreihafcvgqpktxi7ugcwgfru5pm77due6skn6gkkqdq7jw7uodnzwxy","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6v7ic22","value":{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreidokrfnhzk5mnwcicnvw7cuorg2qgnpotk2vicwcuhxeua2cxwur4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6uky222","value":{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreibd6kqdmg5bvqvfme3nu76crz5hpdygbuvtfo5z6gmn73pm23c4bi","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6pppc22","value":{"text":"Wen token","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}}},"createdAt":"2022-07-15T00:47:46.914Z"}}},"createdAt":"2022-07-15T00:47:53.914Z"}}},"createdAt":"2022-07-15T00:47:54.914Z"}}},"createdAt":"2022-07-15T00:48:14.914Z"}	2024-06-07T12:43:09.631Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6cnqc22	bafyreid273gys3wrzpedo7uguxwxq6c5iqyji63uqrbxq7xd2v5645rrja	did:plc:zluht54hsscg6octtayzd3ft	{"text":"I need the best man on this. Someone who knows that plane inside and out and won’t crack under pressure. How about Mister Rogers?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:31.914Z"}	2024-06-07T12:43:08.568Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6c27c22	bafyreiajg2rg4ysiluze35qqjdymgc7sy34ovwssevuqpvxvxozsodocp4	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"Johnny, what can you make out of this?\\n  This? Why, I can make a hat or a brooch or a pterodactyl…","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:30.914Z"}	2024-06-07T12:43:08.549Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6sar222	bafyreih5bwjxfretqbmnmtnh2nmfoxrugkrsydmgo73izz26k64mxtxshy	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"lol","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}},"parent":{"cid":"bafyreid2w2wi55ko3m3lcj6puvrywdcfey2dapgg2raddqvcjq5jxkw6be","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6p55k22","value":{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}},"parent":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}}},"createdAt":"2022-07-15T00:47:45.914Z"}}},"createdAt":"2022-07-15T00:47:50.914Z"}	2024-06-07T12:43:09.081Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm72ncs22	bafyreifsu7lckdjbk6tunuxynocyxwfcwafnjsysnyjqtxpse53jj3eyru	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22","value":{"text":"Looks like I picked the wrong week to quit amphetamines.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:21.914Z"}},"parent":{"cid":"bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22","value":{"text":"Looks like I picked the wrong week to quit amphetamines.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:21.914Z"}}},"createdAt":"2022-07-15T00:48:02.914Z"}	2024-06-07T12:43:09.355Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm73bt222	bafyreih3vtpmaliuufzvmvp2xh74kgwpnnam7axm3c24o6besdvqzg3bg4	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"This is sort of accurate, but honestly it misses a huge part of the issue at hand. There are just so many factors and I don't think a vibe is enough to cover it.","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifsazs5bwjay324fnkz5ecluwy4bpehh5iwdkwmerj7ywhjj7pcnq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22","value":{"text":"Shanna, they bought their tickets, they knew what they were getting into. I say, let 'em crash.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:36.914Z"}},"parent":{"cid":"bafyreifsazs5bwjay324fnkz5ecluwy4bpehh5iwdkwmerj7ywhjj7pcnq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22","value":{"text":"Shanna, they bought their tickets, they knew what they were getting into. I say, let 'em crash.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:36.914Z"}}},"createdAt":"2022-07-15T00:48:03.914Z"}	2024-06-07T12:43:09.376Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm73ues22	bafyreigntykfl6qep45vt6wq46qrs7huq5opddpw5z2glomc24p2mdfjty	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"Wow, so true!","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}},"parent":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}}},"createdAt":"2022-07-15T00:48:04.914Z"}	2024-06-07T12:43:09.395Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7eetk22	bafyreicktcft44xal23bti6zihdlbldfrjii7r3zuro5djfbdmmrle5rem	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"lol","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreideidtqpviy6deov3hiv2bph4ngud6snrf3rqj62e7n56me3accuy","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6qcb222","value":{"text":"This is sort of accurate, but honestly it misses a huge part of the issue at hand. There are just so many factors and I don't think a vibe is enough to cover it.","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreicyq7eldus5jwjulcgmbijfzkiqyfbnoo74fmowj5n2ydxqc4q7he","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22","value":{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}}},"createdAt":"2022-07-15T00:47:41.914Z"}}},"createdAt":"2022-07-15T00:47:47.914Z"}}},"createdAt":"2022-07-15T00:48:16.914Z"}	2024-06-07T12:43:09.673Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7tm5c22	bafyreidvpfwzrp7zlftziynbgybw2d5vh36yirkrtvwollweu7o2i4l4ki	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"lol","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22","value":{"text":"I just want to tell you both good luck. We're all counting on you.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:27.914Z"}},"parent":{"cid":"bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22","value":{"text":"I just want to tell you both good luck. We're all counting on you.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:27.914Z"}}},"createdAt":"2022-07-15T00:48:39.914Z"}	2024-06-07T12:43:10.175Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmb76oc22	bafyreidcnsfupzhs4jfqjgy3bjhwo7anrva4zfllwe2gm2l2qqlawssiey	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreibbfl3v22jf4vneuwi3wy73d3t2xnqdc4cnb6dqhh4oxwqf6xuxsm","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ndjs22"},"createdAt":"2022-07-15T00:49:46.914Z"}	2024-06-07T12:43:11.601Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbajnc22	bafyreihjdf4rjtedv2iunnkge6orfvhfxggymubyny3qiwq3l43q4xdxhi	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreibd6kqdmg5bvqvfme3nu76crz5hpdygbuvtfo5z6gmn73pm23c4bi","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6pppc22"},"createdAt":"2022-07-15T00:49:48.914Z"}	2024-06-07T12:43:11.651Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22	bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}	2024-06-07T12:43:08.602Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6k6x222	bafyreicbtupktruxgtg3wyw3ptx6ntmmchwyapczem2p24cbhynm24amxm	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"naughty post","$type":"app.bsky.feed.post","embed":{"$type":"app.bsky.embed.images","images":[{"alt":"naughty naughty","image":{"$type":"blob","ref":{"$link":"bafkreidp4fmd27x4qpjxjzvxlun6l5a4zuhkvq4dv4vgjz4hx7wxlrlprq"},"mimeType":"image/png","size":17203}}]},"createdAt":"2022-07-15T00:47:37.914Z"}	2024-06-07T12:43:08.818Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6kpkc22	bafyreiabae2vvj5z2jaqmxsmskvay5gnmlgiump7ol2kgebvnwhyacr5ou	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"reallly bad post should be deleted","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:38.914Z"}	2024-06-07T12:43:08.831Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6nw3k22	bafyreicznkuorm6ypgy3cgltnqqfncnhd2ddueiwfotpubqfinepkrsm74	did:plc:zluht54hsscg6octtayzd3ft	{"text":"Wow, so true!","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreibl6nrxujzusdkawwdxoegdgbysqt3wu7xrpimtyeqij4ldrdpvt4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm5zpm222","value":{"text":"I am serious...and don't call me Shirley.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:18.914Z"}},"parent":{"cid":"bafyreibl6nrxujzusdkawwdxoegdgbysqt3wu7xrpimtyeqij4ldrdpvt4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm5zpm222","value":{"text":"I am serious...and don't call me Shirley.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:18.914Z"}}},"createdAt":"2022-07-15T00:47:43.914Z"}	2024-06-07T12:43:08.937Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6oho222	bafyreidztf4duw63m5xb6uisugocsmehokjp6sb7jyjqwxmu65pyt34s7m	did:plc:zluht54hsscg6octtayzd3ft	{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreiarenp2r55zrv52fnig3wyttvdcluenvbu2m3oqte7qn4js54f5dq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6lgyc22","value":{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}}},"createdAt":"2022-07-15T00:47:39.914Z"}}},"createdAt":"2022-07-15T00:47:44.914Z"}	2024-06-07T12:43:08.956Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6t62k22	bafyreia4smzotwpndfww2bxdmhqgovxq7pas5klmjwg2czsx2z6cv56e6m	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreigytipb36mr5photttbnc7yrmy75tnwvcvohx3kg56vod5n522slq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6qxqk22","value":{"text":"is it cool if I DM?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreicyq7eldus5jwjulcgmbijfzkiqyfbnoo74fmowj5n2ydxqc4q7he","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22","value":{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}}},"createdAt":"2022-07-15T00:47:41.914Z"}}},"createdAt":"2022-07-15T00:47:48.914Z"}}},"createdAt":"2022-07-15T00:47:51.914Z"}	2024-06-07T12:43:09.113Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6v7ic22	bafyreihafcvgqpktxi7ugcwgfru5pm77due6skn6gkkqdq7jw7uodnzwxy	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreidokrfnhzk5mnwcicnvw7cuorg2qgnpotk2vicwcuhxeua2cxwur4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6uky222","value":{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreibd6kqdmg5bvqvfme3nu76crz5hpdygbuvtfo5z6gmn73pm23c4bi","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6pppc22","value":{"text":"Wen token","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}}},"createdAt":"2022-07-15T00:47:46.914Z"}}},"createdAt":"2022-07-15T00:47:53.914Z"}}},"createdAt":"2022-07-15T00:47:54.914Z"}	2024-06-07T12:43:09.177Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6wiis22	bafyreigfuziopyoqcyv5jx6n7farmuxqmt6o3eeyszctl2xveyahtucnhe	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"What does this mean for pet owners in the midterms?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22","value":{"text":"I just want to tell you both good luck. We're all counting on you.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:27.914Z"}},"parent":{"cid":"bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22","value":{"text":"I just want to tell you both good luck. We're all counting on you.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:27.914Z"}}},"createdAt":"2022-07-15T00:47:56.914Z"}	2024-06-07T12:43:09.223Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6zuvk22	bafyreihjmjhi6ovt77ffrwdttf4m2xmfi6ug5wczn2xccetuw2nj2racd4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}},"parent":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}}},"createdAt":"2022-07-15T00:48:01.914Z"}	2024-06-07T12:43:09.331Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmb7qas22	bafyreicv5j6o4ykufpkoazq3hexj6gusojcok37mgvcrbmchpaqhilet4y	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreibbfl3v22jf4vneuwi3wy73d3t2xnqdc4cnb6dqhh4oxwqf6xuxsm","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ndjs22"},"createdAt":"2022-07-15T00:49:47.914Z"}	2024-06-07T12:43:11.627Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6p55k22	bafyreid2w2wi55ko3m3lcj6puvrywdcfey2dapgg2raddqvcjq5jxkw6be	did:plc:zluht54hsscg6octtayzd3ft	{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}},"parent":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}}},"createdAt":"2022-07-15T00:47:45.914Z"}	2024-06-07T12:43:08.977Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xaw222	bafyreiaip7e3kif6rhhvkx4dckwbm3egog6sn7kkf4x5e2puj6d4lkit2m	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"lol","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}},"parent":{"cid":"bafyreiazf5m4p3ly542yppowxjctwxq6bo7wqn3vxhwlw4zf6gafagjdmi","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6twhs22","value":{"text":"Wen token","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}},"parent":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}}},"createdAt":"2022-07-15T00:47:52.914Z"}}},"createdAt":"2022-07-15T00:47:57.914Z"}	2024-06-07T12:43:09.243Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm76di222	bafyreict3zjalmndopvzm4rd5nzx2lz3spqnphfzifmoz7f3odke2jqptq	did:plc:zluht54hsscg6octtayzd3ft	{"text":"What does this mean for pet owners in the midterms?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreicyq7eldus5jwjulcgmbijfzkiqyfbnoo74fmowj5n2ydxqc4q7he","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22","value":{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}}},"createdAt":"2022-07-15T00:47:41.914Z"}}},"createdAt":"2022-07-15T00:48:08.914Z"}	2024-06-07T12:43:09.485Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7aby222	bafyreicwdnl52rm2basxdhgvcwvmac6iesq34njgbbschzx4usgzsf42ei	did:plc:zluht54hsscg6octtayzd3ft	{"text":"is it cool if I DM?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreideidtqpviy6deov3hiv2bph4ngud6snrf3rqj62e7n56me3accuy","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6qcb222","value":{"text":"This is sort of accurate, but honestly it misses a huge part of the issue at hand. There are just so many factors and I don't think a vibe is enough to cover it.","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreicyq7eldus5jwjulcgmbijfzkiqyfbnoo74fmowj5n2ydxqc4q7he","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22","value":{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}}},"createdAt":"2022-07-15T00:47:41.914Z"}}},"createdAt":"2022-07-15T00:47:47.914Z"}}},"createdAt":"2022-07-15T00:48:10.914Z"}	2024-06-07T12:43:09.541Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7dqdc22	bafyreig63wu7skovixex2waesavh2ifjmbxbgohfggaag35kkmovwh2u7u	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"What does this mean for pet owners in the midterms?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}},"parent":{"cid":"bafyreiaip7e3kif6rhhvkx4dckwbm3egog6sn7kkf4x5e2puj6d4lkit2m","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xaw222","value":{"text":"lol","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}},"parent":{"cid":"bafyreiazf5m4p3ly542yppowxjctwxq6bo7wqn3vxhwlw4zf6gafagjdmi","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6twhs22","value":{"text":"Wen token","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}},"parent":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}}},"createdAt":"2022-07-15T00:47:52.914Z"}}},"createdAt":"2022-07-15T00:47:57.914Z"}}},"createdAt":"2022-07-15T00:48:15.914Z"}	2024-06-07T12:43:09.652Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7exfc22	bafyreidc3o4sc4xts5dchqstdesgsca2nwtmgjl3ipbtef47bludcr6wry	did:plc:zluht54hsscg6octtayzd3ft	{"text":"Haha ikr","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreid273gys3wrzpedo7uguxwxq6c5iqyji63uqrbxq7xd2v5645rrja","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6cnqc22","value":{"text":"I need the best man on this. Someone who knows that plane inside and out and won’t crack under pressure. How about Mister Rogers?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:31.914Z"}},"parent":{"cid":"bafyreid273gys3wrzpedo7uguxwxq6c5iqyji63uqrbxq7xd2v5645rrja","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6cnqc22","value":{"text":"I need the best man on this. Someone who knows that plane inside and out and won’t crack under pressure. How about Mister Rogers?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:31.914Z"}}},"createdAt":"2022-07-15T00:48:17.914Z"}	2024-06-07T12:43:09.693Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7hles22	bafyreiat6kavehlet5nmwsgctjpeukavhtkalikajn54efgle2mmv2opzu	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreigytipb36mr5photttbnc7yrmy75tnwvcvohx3kg56vod5n522slq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6qxqk22","value":{"text":"is it cool if I DM?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreicyq7eldus5jwjulcgmbijfzkiqyfbnoo74fmowj5n2ydxqc4q7he","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22","value":{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}}},"createdAt":"2022-07-15T00:47:41.914Z"}}},"createdAt":"2022-07-15T00:47:48.914Z"}}},"createdAt":"2022-07-15T00:48:21.914Z"}	2024-06-07T12:43:09.781Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6vszc22	bafyreifgmn2zhq5qstdcc77yedzggkow3gz67c6daubgntpqi7uktqkpam	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"What does this mean for pet owners in the midterms?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiahrxynudxg5rk76kw5mbcr65gjuli76szgmm3m3bso6ewxtkyngq","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64eks22","value":{"text":"Looks like I picked the wrong week to quit sniffing glue.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:22.914Z"}},"parent":{"cid":"bafyreiahrxynudxg5rk76kw5mbcr65gjuli76szgmm3m3bso6ewxtkyngq","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64eks22","value":{"text":"Looks like I picked the wrong week to quit sniffing glue.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:22.914Z"}}},"createdAt":"2022-07-15T00:47:55.914Z"}	2024-06-07T12:43:09.196Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm77cq222	bafyreifxrysbjhvhafppbgxwgg6tm6ye4iq56d6wft5ivjo6tyu7yke3be	did:plc:zluht54hsscg6octtayzd3ft	{"text":"What does this mean for pet owners in the midterms?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreicyq7eldus5jwjulcgmbijfzkiqyfbnoo74fmowj5n2ydxqc4q7he","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22","value":{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}}},"createdAt":"2022-07-15T00:47:41.914Z"}}},"createdAt":"2022-07-15T00:48:09.914Z"}	2024-06-07T12:43:09.515Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7fjx222	bafyreigtv3xbvf7zecdzzaljrirvng6dn25cuzu2s7vrwejalkx3boli7e	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"is it cool if I DM?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreidwwfbydjpoh5pm363uhfzdejxsuutwm4cpsv2ptht4x5q5ug22by","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm63k7222","value":{"text":"Looks like I picked the wrong week to quit drinking.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:20.914Z"}},"parent":{"cid":"bafyreigfwyy5uw74g2gkfilquplidccubgxpvdihuvwjnkag2iogetp5fu","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6m2jc22","value":{"text":"Wen token","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreidwwfbydjpoh5pm363uhfzdejxsuutwm4cpsv2ptht4x5q5ug22by","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm63k7222","value":{"text":"Looks like I picked the wrong week to quit drinking.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:20.914Z"}},"parent":{"cid":"bafyreidwwfbydjpoh5pm363uhfzdejxsuutwm4cpsv2ptht4x5q5ug22by","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm63k7222","value":{"text":"Looks like I picked the wrong week to quit drinking.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:20.914Z"}}},"createdAt":"2022-07-15T00:47:40.914Z"}}},"createdAt":"2022-07-15T00:48:18.914Z"}	2024-06-07T12:43:09.712Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7l2pc22	bafyreicho5whst5kg2exmu7jl4yk7iyihmpqqkvdqx2sa4tkitxsdxsrgu	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}},"parent":{"cid":"bafyreihjmjhi6ovt77ffrwdttf4m2xmfi6ug5wczn2xccetuw2nj2racd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6zuvk22","value":{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}},"parent":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}}},"createdAt":"2022-07-15T00:48:01.914Z"}}},"createdAt":"2022-07-15T00:48:26.914Z"}	2024-06-07T12:43:09.893Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7pn6s22	bafyreigvlrrozbjn3gxkcp44pspjbmtawgdxjw7qytnv2ts3rtqzgvpsqy	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"finally! decentralization!","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}},"parent":{"cid":"bafyreibc6lqv5cla3g6xfubafiwapmfzvgbakgfwgcwcjkiwpaj4wyooqm","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7mcqk22","value":{"text":"a/s/l?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}},"parent":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}}},"createdAt":"2022-07-15T00:48:28.914Z"}}},"createdAt":"2022-07-15T00:48:33.914Z"}	2024-06-07T12:43:10.045Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmac3z222	bafyreiahz6chrakkw7en4ceothts6uyxlualmbsgaaaruneiouc4t4uqa4	did:plc:zluht54hsscg6octtayzd3ft	{"text":"is it cool if I DM?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}}},"createdAt":"2022-07-15T00:48:59.914Z"}	2024-06-07T12:43:10.651Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6uky222	bafyreidokrfnhzk5mnwcicnvw7cuorg2qgnpotk2vicwcuhxeua2cxwur4	did:plc:zluht54hsscg6octtayzd3ft	{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreibd6kqdmg5bvqvfme3nu76crz5hpdygbuvtfo5z6gmn73pm23c4bi","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6pppc22","value":{"text":"Wen token","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}}},"createdAt":"2022-07-15T00:47:46.914Z"}}},"createdAt":"2022-07-15T00:47:53.914Z"}	2024-06-07T12:43:09.155Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xxes22	bafyreidqo3vj5ry5kvsm4srfutz27dtzkmqdzcq7sxouhcmxslcybcqf4m	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"Wow, so true!","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifsazs5bwjay324fnkz5ecluwy4bpehh5iwdkwmerj7ywhjj7pcnq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22","value":{"text":"Shanna, they bought their tickets, they knew what they were getting into. I say, let 'em crash.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:36.914Z"}},"parent":{"cid":"bafyreifsazs5bwjay324fnkz5ecluwy4bpehh5iwdkwmerj7ywhjj7pcnq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22","value":{"text":"Shanna, they bought their tickets, they knew what they were getting into. I say, let 'em crash.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:36.914Z"}}},"createdAt":"2022-07-15T00:47:58.914Z"}	2024-06-07T12:43:09.268Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6yoss22	bafyreifet3tq7lfikiwmcbp4puqxs5vl35otyg4skzvqdjjtq75juzazxq	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifsazs5bwjay324fnkz5ecluwy4bpehh5iwdkwmerj7ywhjj7pcnq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22","value":{"text":"Shanna, they bought their tickets, they knew what they were getting into. I say, let 'em crash.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:36.914Z"}},"parent":{"cid":"bafyreidqo3vj5ry5kvsm4srfutz27dtzkmqdzcq7sxouhcmxslcybcqf4m","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xxes22","value":{"text":"Wow, so true!","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifsazs5bwjay324fnkz5ecluwy4bpehh5iwdkwmerj7ywhjj7pcnq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22","value":{"text":"Shanna, they bought their tickets, they knew what they were getting into. I say, let 'em crash.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:36.914Z"}},"parent":{"cid":"bafyreifsazs5bwjay324fnkz5ecluwy4bpehh5iwdkwmerj7ywhjj7pcnq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22","value":{"text":"Shanna, they bought their tickets, they knew what they were getting into. I say, let 'em crash.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:36.914Z"}}},"createdAt":"2022-07-15T00:47:58.914Z"}}},"createdAt":"2022-07-15T00:47:59.914Z"}	2024-06-07T12:43:09.290Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm74zic22	bafyreibom4ih33aggpyno5jlmjlaxjybicxr3wcotkmaf4xqila67dnhhu	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifsazs5bwjay324fnkz5ecluwy4bpehh5iwdkwmerj7ywhjj7pcnq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22","value":{"text":"Shanna, they bought their tickets, they knew what they were getting into. I say, let 'em crash.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:36.914Z"}},"parent":{"cid":"bafyreih3vtpmaliuufzvmvp2xh74kgwpnnam7axm3c24o6besdvqzg3bg4","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm73bt222","value":{"text":"This is sort of accurate, but honestly it misses a huge part of the issue at hand. There are just so many factors and I don't think a vibe is enough to cover it.","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifsazs5bwjay324fnkz5ecluwy4bpehh5iwdkwmerj7ywhjj7pcnq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22","value":{"text":"Shanna, they bought their tickets, they knew what they were getting into. I say, let 'em crash.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:36.914Z"}},"parent":{"cid":"bafyreifsazs5bwjay324fnkz5ecluwy4bpehh5iwdkwmerj7ywhjj7pcnq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22","value":{"text":"Shanna, they bought their tickets, they knew what they were getting into. I say, let 'em crash.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:36.914Z"}}},"createdAt":"2022-07-15T00:48:03.914Z"}}},"createdAt":"2022-07-15T00:48:06.914Z"}	2024-06-07T12:43:09.432Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7awic22	bafyreie5deuo4q3cbbfcms72ew3fhnpljyclzrqfc7ybathfcj54lyqu4e	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"This is sort of accurate, but honestly it misses a huge part of the issue at hand. There are just so many factors and I don't think a vibe is enough to cover it.","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreidxjakkbifqysatmszjyvoa3usbnenyadx2dvxhebektepcvu4hry","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm66hx222","value":{"text":"These people need to go to a hospital.\\nWhat is it?\\nIt's a big place where sick people go, but that's not important right now.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:26.914Z"}},"parent":{"cid":"bafyreidxjakkbifqysatmszjyvoa3usbnenyadx2dvxhebektepcvu4hry","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm66hx222","value":{"text":"These people need to go to a hospital.\\nWhat is it?\\nIt's a big place where sick people go, but that's not important right now.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:26.914Z"}}},"createdAt":"2022-07-15T00:48:11.914Z"}	2024-06-07T12:43:09.563Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7cbhc22	bafyreiczpp4iuoulzhklxt5adsz7eamtxr5pq45bnm2g4pa2opidgc2r3u	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"is it cool if I DM?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22","value":{"text":"Looks like I picked the wrong week to quit amphetamines.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:21.914Z"}},"parent":{"cid":"bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22","value":{"text":"Looks like I picked the wrong week to quit amphetamines.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:21.914Z"}}},"createdAt":"2022-07-15T00:48:13.914Z"}	2024-06-07T12:43:09.607Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm75mzc22	bafyreihwcj7qlqtq4iwyi7vez4bf4akjqjpeysaxqcoyzvg5dgvuzofip4	did:plc:zluht54hsscg6octtayzd3ft	{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreicyq7eldus5jwjulcgmbijfzkiqyfbnoo74fmowj5n2ydxqc4q7he","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22","value":{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}}},"createdAt":"2022-07-15T00:47:41.914Z"}}},"createdAt":"2022-07-15T00:48:07.914Z"}	2024-06-07T12:43:09.451Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7blxs22	bafyreigzrkdypcw6rzkdswhct6ay552cpzukzcfmrdxdhfi4tx2bfg3yaq	did:plc:zluht54hsscg6octtayzd3ft	{"text":"Haha ikr","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiahrxynudxg5rk76kw5mbcr65gjuli76szgmm3m3bso6ewxtkyngq","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64eks22","value":{"text":"Looks like I picked the wrong week to quit sniffing glue.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:22.914Z"}},"parent":{"cid":"bafyreifgmn2zhq5qstdcc77yedzggkow3gz67c6daubgntpqi7uktqkpam","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6vszc22","value":{"text":"What does this mean for pet owners in the midterms?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiahrxynudxg5rk76kw5mbcr65gjuli76szgmm3m3bso6ewxtkyngq","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64eks22","value":{"text":"Looks like I picked the wrong week to quit sniffing glue.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:22.914Z"}},"parent":{"cid":"bafyreiahrxynudxg5rk76kw5mbcr65gjuli76szgmm3m3bso6ewxtkyngq","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64eks22","value":{"text":"Looks like I picked the wrong week to quit sniffing glue.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:22.914Z"}}},"createdAt":"2022-07-15T00:47:55.914Z"}}},"createdAt":"2022-07-15T00:48:12.914Z"}	2024-06-07T12:43:09.583Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7j2as22	bafyreih3yrxva7euqbsiozt473ou6giubfjq5dujecdoehkr7vuggkfxsu	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiahrxynudxg5rk76kw5mbcr65gjuli76szgmm3m3bso6ewxtkyngq","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64eks22","value":{"text":"Looks like I picked the wrong week to quit sniffing glue.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:22.914Z"}},"parent":{"cid":"bafyreiahrxynudxg5rk76kw5mbcr65gjuli76szgmm3m3bso6ewxtkyngq","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64eks22","value":{"text":"Looks like I picked the wrong week to quit sniffing glue.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:22.914Z"}}},"createdAt":"2022-07-15T00:48:23.914Z"}	2024-06-07T12:43:09.827Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7mcqk22	bafyreibc6lqv5cla3g6xfubafiwapmfzvgbakgfwgcwcjkiwpaj4wyooqm	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"a/s/l?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}},"parent":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}}},"createdAt":"2022-07-15T00:48:28.914Z"}	2024-06-07T12:43:09.934Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7of5k22	bafyreibjpq4ipgtmol5ckai6544ipyqmvevvjakzc4x46ac3jhfyrm7gfy	did:plc:zluht54hsscg6octtayzd3ft	{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreicwdnl52rm2basxdhgvcwvmac6iesq34njgbbschzx4usgzsf42ei","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7aby222","value":{"text":"is it cool if I DM?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreideidtqpviy6deov3hiv2bph4ngud6snrf3rqj62e7n56me3accuy","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6qcb222","value":{"text":"This is sort of accurate, but honestly it misses a huge part of the issue at hand. There are just so many factors and I don't think a vibe is enough to cover it.","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreicyq7eldus5jwjulcgmbijfzkiqyfbnoo74fmowj5n2ydxqc4q7he","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22","value":{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}}},"createdAt":"2022-07-15T00:47:41.914Z"}}},"createdAt":"2022-07-15T00:47:47.914Z"}}},"createdAt":"2022-07-15T00:48:10.914Z"}}},"createdAt":"2022-07-15T00:48:31.914Z"}	2024-06-07T12:43:10.001Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7qglc22	bafyreiduw3nbbzfjcxoa37imhi5qtdkjr2bkxgq6k4srpwpab6zpgcxlqm	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"This is sort of accurate, but honestly it misses a huge part of the issue at hand. There are just so many factors and I don't think a vibe is enough to cover it.","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreidokrfnhzk5mnwcicnvw7cuorg2qgnpotk2vicwcuhxeua2cxwur4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6uky222","value":{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreibd6kqdmg5bvqvfme3nu76crz5hpdygbuvtfo5z6gmn73pm23c4bi","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6pppc22","value":{"text":"Wen token","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}}},"createdAt":"2022-07-15T00:47:46.914Z"}}},"createdAt":"2022-07-15T00:47:53.914Z"}}},"createdAt":"2022-07-15T00:48:34.914Z"}	2024-06-07T12:43:10.069Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma7h2c22	bafyreidrqkwmhh2yxhpkbisqufrib2mysgrztuof6s2ur6p7362n5ozk4q	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"Wow, so true!","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreiajzithxxyp3pm5rzwxs4iz6ej4nfo7jj5y3uk77nxfd4o5hxjgza","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7wa4s22","value":{"text":"lol","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreihafcvgqpktxi7ugcwgfru5pm77due6skn6gkkqdq7jw7uodnzwxy","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6v7ic22","value":{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreidokrfnhzk5mnwcicnvw7cuorg2qgnpotk2vicwcuhxeua2cxwur4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6uky222","value":{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreibd6kqdmg5bvqvfme3nu76crz5hpdygbuvtfo5z6gmn73pm23c4bi","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6pppc22","value":{"text":"Wen token","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}}},"createdAt":"2022-07-15T00:47:46.914Z"}}},"createdAt":"2022-07-15T00:47:53.914Z"}}},"createdAt":"2022-07-15T00:47:54.914Z"}}},"createdAt":"2022-07-15T00:48:43.914Z"}}},"createdAt":"2022-07-15T00:48:56.914Z"}	2024-06-07T12:43:10.563Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm74gwk22	bafyreibjfpn3ozc6rjzkjytahzatd77uarqqnnswivuvi2suhdycsmcflu	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"Wen token","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22","value":{"text":"I just want to tell you both good luck. We're all counting on you.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:27.914Z"}},"parent":{"cid":"bafyreigfuziopyoqcyv5jx6n7farmuxqmt6o3eeyszctl2xveyahtucnhe","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6wiis22","value":{"text":"What does this mean for pet owners in the midterms?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22","value":{"text":"I just want to tell you both good luck. We're all counting on you.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:27.914Z"}},"parent":{"cid":"bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22","value":{"text":"I just want to tell you both good luck. We're all counting on you.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:27.914Z"}}},"createdAt":"2022-07-15T00:47:56.914Z"}}},"createdAt":"2022-07-15T00:48:05.914Z"}	2024-06-07T12:43:09.413Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7gvvc22	bafyreiglrva5gmt5mumpuj55c2wxbnknijfsztiz6n7imalmlv63a4bhk4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"What does this mean for pet owners in the midterms?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}},"parent":{"cid":"bafyreig63wu7skovixex2waesavh2ifjmbxbgohfggaag35kkmovwh2u7u","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7dqdc22","value":{"text":"What does this mean for pet owners in the midterms?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}},"parent":{"cid":"bafyreiaip7e3kif6rhhvkx4dckwbm3egog6sn7kkf4x5e2puj6d4lkit2m","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xaw222","value":{"text":"lol","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}},"parent":{"cid":"bafyreiazf5m4p3ly542yppowxjctwxq6bo7wqn3vxhwlw4zf6gafagjdmi","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6twhs22","value":{"text":"Wen token","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}},"parent":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}}},"createdAt":"2022-07-15T00:47:52.914Z"}}},"createdAt":"2022-07-15T00:47:57.914Z"}}},"createdAt":"2022-07-15T00:48:15.914Z"}}},"createdAt":"2022-07-15T00:48:20.914Z"}	2024-06-07T12:43:09.757Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7ihp222	bafyreictq5xj4uggp3kaonouugalckasgzcvihlygzrbgnkz3npv3umhyu	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"What does this mean for pet owners in the midterms?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifsazs5bwjay324fnkz5ecluwy4bpehh5iwdkwmerj7ywhjj7pcnq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22","value":{"text":"Shanna, they bought their tickets, they knew what they were getting into. I say, let 'em crash.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:36.914Z"}},"parent":{"cid":"bafyreibom4ih33aggpyno5jlmjlaxjybicxr3wcotkmaf4xqila67dnhhu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm74zic22","value":{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifsazs5bwjay324fnkz5ecluwy4bpehh5iwdkwmerj7ywhjj7pcnq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22","value":{"text":"Shanna, they bought their tickets, they knew what they were getting into. I say, let 'em crash.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:36.914Z"}},"parent":{"cid":"bafyreih3vtpmaliuufzvmvp2xh74kgwpnnam7axm3c24o6besdvqzg3bg4","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm73bt222","value":{"text":"This is sort of accurate, but honestly it misses a huge part of the issue at hand. There are just so many factors and I don't think a vibe is enough to cover it.","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifsazs5bwjay324fnkz5ecluwy4bpehh5iwdkwmerj7ywhjj7pcnq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22","value":{"text":"Shanna, they bought their tickets, they knew what they were getting into. I say, let 'em crash.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:36.914Z"}},"parent":{"cid":"bafyreifsazs5bwjay324fnkz5ecluwy4bpehh5iwdkwmerj7ywhjj7pcnq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22","value":{"text":"Shanna, they bought their tickets, they knew what they were getting into. I say, let 'em crash.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:36.914Z"}}},"createdAt":"2022-07-15T00:48:03.914Z"}}},"createdAt":"2022-07-15T00:48:06.914Z"}}},"createdAt":"2022-07-15T00:48:22.914Z"}	2024-06-07T12:43:09.807Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7keak22	bafyreib5eet7fqeo3c7yujtnsvudsfcb44tmzxhcvxa6ogev2q6t5yfa5q	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"Wen token","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreideidtqpviy6deov3hiv2bph4ngud6snrf3rqj62e7n56me3accuy","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6qcb222","value":{"text":"This is sort of accurate, but honestly it misses a huge part of the issue at hand. There are just so many factors and I don't think a vibe is enough to cover it.","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreicyq7eldus5jwjulcgmbijfzkiqyfbnoo74fmowj5n2ydxqc4q7he","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22","value":{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}}},"createdAt":"2022-07-15T00:47:41.914Z"}}},"createdAt":"2022-07-15T00:47:47.914Z"}}},"createdAt":"2022-07-15T00:48:25.914Z"}	2024-06-07T12:43:09.871Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7lp7k22	bafyreibtftyjrbiemgppzwvro2sm3mqryfdya3wuuqw3q7vcfproc6z5a4	did:plc:zluht54hsscg6octtayzd3ft	{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreibl6nrxujzusdkawwdxoegdgbysqt3wu7xrpimtyeqij4ldrdpvt4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm5zpm222","value":{"text":"I am serious...and don't call me Shirley.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:18.914Z"}},"parent":{"cid":"bafyreibl6nrxujzusdkawwdxoegdgbysqt3wu7xrpimtyeqij4ldrdpvt4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm5zpm222","value":{"text":"I am serious...and don't call me Shirley.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:18.914Z"}}},"createdAt":"2022-07-15T00:48:27.914Z"}	2024-06-07T12:43:09.914Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7npo222	bafyreifktbxrueu6rfzzmsva4wn6cso23x4qrxcjqgrrk4f6upo4t6dd2m	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"Haha ikr","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}},"parent":{"cid":"bafyreig63wu7skovixex2waesavh2ifjmbxbgohfggaag35kkmovwh2u7u","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7dqdc22","value":{"text":"What does this mean for pet owners in the midterms?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}},"parent":{"cid":"bafyreiaip7e3kif6rhhvkx4dckwbm3egog6sn7kkf4x5e2puj6d4lkit2m","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xaw222","value":{"text":"lol","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}},"parent":{"cid":"bafyreiazf5m4p3ly542yppowxjctwxq6bo7wqn3vxhwlw4zf6gafagjdmi","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6twhs22","value":{"text":"Wen token","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}},"parent":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}}},"createdAt":"2022-07-15T00:47:52.914Z"}}},"createdAt":"2022-07-15T00:47:57.914Z"}}},"createdAt":"2022-07-15T00:48:15.914Z"}}},"createdAt":"2022-07-15T00:48:30.914Z"}	2024-06-07T12:43:09.980Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7p2n222	bafyreigiqmzmew4cu6eeualqhurezkrtsunelk3hnzpc7ot3o23lhornvq	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}},"parent":{"cid":"bafyreicho5whst5kg2exmu7jl4yk7iyihmpqqkvdqx2sa4tkitxsdxsrgu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7l2pc22","value":{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}},"parent":{"cid":"bafyreihjmjhi6ovt77ffrwdttf4m2xmfi6ug5wczn2xccetuw2nj2racd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6zuvk22","value":{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}},"parent":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}}},"createdAt":"2022-07-15T00:48:01.914Z"}}},"createdAt":"2022-07-15T00:48:26.914Z"}}},"createdAt":"2022-07-15T00:48:32.914Z"}	2024-06-07T12:43:10.024Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmar4i222	bafyreiggkxvej75yamo77xvn52ua3uq5g6bonyq66ewaon4zzjn6cit6am	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22"},"createdAt":"2022-07-15T00:49:19.914Z"}	2024-06-07T12:43:11.142Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7gafs22	bafyreibw5y2w5tkkh3lwespoggcetavx2pmxnm6owicueqocrppxeftokq	did:plc:zluht54hsscg6octtayzd3ft	{"text":"lol","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}}},"createdAt":"2022-07-15T00:48:19.914Z"}	2024-06-07T12:43:09.735Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7mz7c22	bafyreid5ptmaadcgwqbehrtblhngprsk6dg2jwmc2j3zosfq7rdn57ztcy	did:plc:zluht54hsscg6octtayzd3ft	{"text":"Wow, so true!","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreiarkx6bnx7jvqoqbq7aozirex5v2356rf2zztbuuwxxfnn7ibqoly","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7jpqc22","value":{"text":"Wow, so true!","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreigytipb36mr5photttbnc7yrmy75tnwvcvohx3kg56vod5n522slq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6qxqk22","value":{"text":"is it cool if I DM?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreicyq7eldus5jwjulcgmbijfzkiqyfbnoo74fmowj5n2ydxqc4q7he","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22","value":{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}}},"createdAt":"2022-07-15T00:47:41.914Z"}}},"createdAt":"2022-07-15T00:47:48.914Z"}}},"createdAt":"2022-07-15T00:48:24.914Z"}}},"createdAt":"2022-07-15T00:48:29.914Z"}	2024-06-07T12:43:09.959Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma227222	bafyreiezftduzsjzbgjfyxkli3vbre3jybpgkilyvpfnhfoxfjthry3byy	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"a/s/l?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiceit7gbs5xammejxeej665pnliyxyogmf4fqkvmakundsmd7mooe","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6bhnk22","value":{"text":"Captain, maybe we ought to turn on the searchlights now.\\nNo… that’s just what they’ll be expecting us to do.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:29.914Z"}},"parent":{"cid":"bafyreiceit7gbs5xammejxeej665pnliyxyogmf4fqkvmakundsmd7mooe","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6bhnk22","value":{"text":"Captain, maybe we ought to turn on the searchlights now.\\nNo… that’s just what they’ll be expecting us to do.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:29.914Z"}}},"createdAt":"2022-07-15T00:48:48.914Z"}	2024-06-07T12:43:10.385Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma2qns22	bafyreidnyqv4p7iwm2tuoi7pfhkqpa3qwwwjsubu6tjxzwianersoc22qi	did:plc:zluht54hsscg6octtayzd3ft	{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreidokrfnhzk5mnwcicnvw7cuorg2qgnpotk2vicwcuhxeua2cxwur4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6uky222","value":{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreibd6kqdmg5bvqvfme3nu76crz5hpdygbuvtfo5z6gmn73pm23c4bi","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6pppc22","value":{"text":"Wen token","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}}},"createdAt":"2022-07-15T00:47:46.914Z"}}},"createdAt":"2022-07-15T00:47:53.914Z"}}},"createdAt":"2022-07-15T00:48:49.914Z"}	2024-06-07T12:43:10.408Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmab2sk22	bafyreifwkhtulxci2yl7bbiq5u4gs2d34ldi5o73svdvakfknp4g73ula4	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"is it cool if I DM?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22","value":{"text":"Looks like I picked the wrong week to quit amphetamines.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:21.914Z"}},"parent":{"cid":"bafyreifl3toeqtvxgbdmp6ov6mcxxivj2entj66xn4x4kfvpp42m7gqr5q","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7rkpk22","value":{"text":"Haha ikr","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22","value":{"text":"Looks like I picked the wrong week to quit amphetamines.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:21.914Z"}},"parent":{"cid":"bafyreiczpp4iuoulzhklxt5adsz7eamtxr5pq45bnm2g4pa2opidgc2r3u","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7cbhc22","value":{"text":"is it cool if I DM?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22","value":{"text":"Looks like I picked the wrong week to quit amphetamines.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:21.914Z"}},"parent":{"cid":"bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22","value":{"text":"Looks like I picked the wrong week to quit amphetamines.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:21.914Z"}}},"createdAt":"2022-07-15T00:48:13.914Z"}}},"createdAt":"2022-07-15T00:48:36.914Z"}}},"createdAt":"2022-07-15T00:48:58.914Z"}	2024-06-07T12:43:10.617Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmacugc22	bafyreigxi6u33zlzunwuosrs73xgn6335oi7p3c4ulzqfedyoqffkt6li4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"Wow, so true!","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreidwwfbydjpoh5pm363uhfzdejxsuutwm4cpsv2ptht4x5q5ug22by","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm63k7222","value":{"text":"Looks like I picked the wrong week to quit drinking.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:20.914Z"}},"parent":{"cid":"bafyreigfwyy5uw74g2gkfilquplidccubgxpvdihuvwjnkag2iogetp5fu","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6m2jc22","value":{"text":"Wen token","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreidwwfbydjpoh5pm363uhfzdejxsuutwm4cpsv2ptht4x5q5ug22by","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm63k7222","value":{"text":"Looks like I picked the wrong week to quit drinking.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:20.914Z"}},"parent":{"cid":"bafyreidwwfbydjpoh5pm363uhfzdejxsuutwm4cpsv2ptht4x5q5ug22by","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm63k7222","value":{"text":"Looks like I picked the wrong week to quit drinking.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:20.914Z"}}},"createdAt":"2022-07-15T00:47:40.914Z"}}},"createdAt":"2022-07-15T00:49:00.914Z"}	2024-06-07T12:43:10.674Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmakqes22	bafyreieqb5mec6ke3bstogsks46ka4hvgop7skmyvwasgigwsb4l4wm6ji	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"is it cool if I DM?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreidnyqv4p7iwm2tuoi7pfhkqpa3qwwwjsubu6tjxzwianersoc22qi","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma2qns22","value":{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreidokrfnhzk5mnwcicnvw7cuorg2qgnpotk2vicwcuhxeua2cxwur4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6uky222","value":{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreibd6kqdmg5bvqvfme3nu76crz5hpdygbuvtfo5z6gmn73pm23c4bi","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6pppc22","value":{"text":"Wen token","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}}},"createdAt":"2022-07-15T00:47:46.914Z"}}},"createdAt":"2022-07-15T00:47:53.914Z"}}},"createdAt":"2022-07-15T00:48:49.914Z"}}},"createdAt":"2022-07-15T00:49:10.914Z"}	2024-06-07T12:43:10.934Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmalis222	bafyreiasu4pjf66p3od3o2mxzct6ivvz43tmghpanlhjnaotmk5hs4pq3y	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"a/s/l?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}}},"createdAt":"2022-07-15T00:49:11.914Z"}	2024-06-07T12:43:10.958Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7jpqc22	bafyreiarkx6bnx7jvqoqbq7aozirex5v2356rf2zztbuuwxxfnn7ibqoly	did:plc:zluht54hsscg6octtayzd3ft	{"text":"Wow, so true!","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreigytipb36mr5photttbnc7yrmy75tnwvcvohx3kg56vod5n522slq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6qxqk22","value":{"text":"is it cool if I DM?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreicyq7eldus5jwjulcgmbijfzkiqyfbnoo74fmowj5n2ydxqc4q7he","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22","value":{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}}},"createdAt":"2022-07-15T00:47:41.914Z"}}},"createdAt":"2022-07-15T00:47:48.914Z"}}},"createdAt":"2022-07-15T00:48:24.914Z"}	2024-06-07T12:43:09.848Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7s6ak22	bafyreiaccvsbkagfya76xdapjcg7ifgmt5fqew4sljcptcbqdlso3rkqpy	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"lol","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}},"parent":{"cid":"bafyreiazf5m4p3ly542yppowxjctwxq6bo7wqn3vxhwlw4zf6gafagjdmi","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6twhs22","value":{"text":"Wen token","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}},"parent":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}}},"createdAt":"2022-07-15T00:47:52.914Z"}}},"createdAt":"2022-07-15T00:48:37.914Z"}	2024-06-07T12:43:10.127Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmahcys22	bafyreiazaf56e45jmxntxyybs6hvwujxn4t23nf25oa76nzrn43jnlctoy	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreibw5y2w5tkkh3lwespoggcetavx2pmxnm6owicueqocrppxeftokq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7gafs22","value":{"text":"lol","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}}},"createdAt":"2022-07-15T00:48:19.914Z"}}},"createdAt":"2022-07-15T00:49:06.914Z"}	2024-06-07T12:43:10.829Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmaro2k22	bafyreictjlrfx3cwbs4pkyt4ykdhd72hlvdox3we4nonghs3psqajn32p4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22"},"createdAt":"2022-07-15T00:49:20.914Z"}	2024-06-07T12:43:11.158Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmast6222	bafyreiby3sbbeqllhigf3nfgcgwcqcedfizyjpoqcvuv6iurntshkynmpu	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreibl6nrxujzusdkawwdxoegdgbysqt3wu7xrpimtyeqij4ldrdpvt4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm5zpm222"},"createdAt":"2022-07-15T00:49:22.914Z"}	2024-06-07T12:43:11.196Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmatcs222	bafyreidgreob26umndt3fictf3aj6p57ntlw3ung3rixldeomvlv3n6ggy	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreidwwfbydjpoh5pm363uhfzdejxsuutwm4cpsv2ptht4x5q5ug22by","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm63k7222"},"createdAt":"2022-07-15T00:49:23.914Z"}	2024-06-07T12:43:11.211Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmauc2222	bafyreidzxdph7qb72edbbg45jqtq3qfuwwkvgnzcpboyjceqclpffhbksy	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22"},"createdAt":"2022-07-15T00:49:25.914Z"}	2024-06-07T12:43:11.244Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmawvzk22	bafyreib45y4vrwkud2iudseoeayyqxbpt6ieaj5pizntqs7jsewc5dietm	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22"},"createdAt":"2022-07-15T00:49:30.914Z"}	2024-06-07T12:43:11.330Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmaxgms22	bafyreigx6de6nh4rphd2ugsudtcbpthevbz77n2bnh67xvrxowqpfludy4	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreidxjakkbifqysatmszjyvoa3usbnenyadx2dvxhebektepcvu4hry","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm66hx222"},"createdAt":"2022-07-15T00:49:31.914Z"}	2024-06-07T12:43:11.348Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmayisk22	bafyreig5wlolcabfgqxrgq3xanzybvlwlm76ms3fqsmwv3aqachu33yuuy	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22"},"createdAt":"2022-07-15T00:49:33.914Z"}	2024-06-07T12:43:11.385Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmaz4dk22	bafyreigpveeovmzswbncal3xm2i6y6jiavtwijaih2amhoaqftzcbruwka	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreicphr7ig7gn4uabxqoocganwhi5njug2flpfc2m4ggdirmgiu5glq","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6ax2c22"},"createdAt":"2022-07-15T00:49:34.914Z"}	2024-06-07T12:43:11.402Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmb567s22	bafyreib63htruqay7izxfhugbujvr546fntcya2dc3zd2ph3qajejsr3fa	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiarenp2r55zrv52fnig3wyttvdcluenvbu2m3oqte7qn4js54f5dq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6lgyc22"},"createdAt":"2022-07-15T00:49:42.914Z"}	2024-06-07T12:43:11.534Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7rkpk22	bafyreifl3toeqtvxgbdmp6ov6mcxxivj2entj66xn4x4kfvpp42m7gqr5q	did:plc:zluht54hsscg6octtayzd3ft	{"text":"Haha ikr","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22","value":{"text":"Looks like I picked the wrong week to quit amphetamines.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:21.914Z"}},"parent":{"cid":"bafyreiczpp4iuoulzhklxt5adsz7eamtxr5pq45bnm2g4pa2opidgc2r3u","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7cbhc22","value":{"text":"is it cool if I DM?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22","value":{"text":"Looks like I picked the wrong week to quit amphetamines.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:21.914Z"}},"parent":{"cid":"bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22","value":{"text":"Looks like I picked the wrong week to quit amphetamines.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:21.914Z"}}},"createdAt":"2022-07-15T00:48:13.914Z"}}},"createdAt":"2022-07-15T00:48:36.914Z"}	2024-06-07T12:43:10.106Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmadluc22	bafyreiccumm4iihqjafzdjj4lhtzwusrwnuefibe4nm3ja337y7zwoqmse	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"Haha ikr","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreicwid24ntku3kmqruypwpgsdkpanhg2emvdvbkuvn3fmppxzlhdqa","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22","value":{"text":"Looks like I picked the wrong week to quit smoking.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:19.914Z"}},"parent":{"cid":"bafyreiad2yqm6qwrpshalzscz644qp3osayprmcddvhwo2dywiqffrm2bi","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmaa4js22","value":{"text":"Wow, so true!","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreicwid24ntku3kmqruypwpgsdkpanhg2emvdvbkuvn3fmppxzlhdqa","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22","value":{"text":"Looks like I picked the wrong week to quit smoking.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:19.914Z"}},"parent":{"cid":"bafyreifhrml2m2oqyue37mn2iwlsirdnpjues76yufy5invzhigguanita","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma5enc22","value":{"text":"This is sort of accurate, but honestly it misses a huge part of the issue at hand. There are just so many factors and I don't think a vibe is enough to cover it.","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreicwid24ntku3kmqruypwpgsdkpanhg2emvdvbkuvn3fmppxzlhdqa","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22","value":{"text":"Looks like I picked the wrong week to quit smoking.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:19.914Z"}},"parent":{"cid":"bafyreicwid24ntku3kmqruypwpgsdkpanhg2emvdvbkuvn3fmppxzlhdqa","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22","value":{"text":"Looks like I picked the wrong week to quit smoking.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:19.914Z"}}},"createdAt":"2022-07-15T00:48:53.914Z"}}},"createdAt":"2022-07-15T00:48:57.914Z"}}},"createdAt":"2022-07-15T00:49:01.914Z"}	2024-06-07T12:43:10.697Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmanm6c22	bafyreihvzfls3zk4ev6s5p3r6ax3e3rrkhw5njjjb3yggnspydxhvhu7aa	did:plc:zluht54hsscg6octtayzd3ft	{"text":"lol","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}},"parent":{"cid":"bafyreicocopqz3vmrs7ndsx7l7rnph3sqpdoshml7f6vx4m2klvzkjpa24","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma6pmc22","value":{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}},"parent":{"cid":"bafyreibc6lqv5cla3g6xfubafiwapmfzvgbakgfwgcwcjkiwpaj4wyooqm","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7mcqk22","value":{"text":"a/s/l?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}},"parent":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}}},"createdAt":"2022-07-15T00:48:28.914Z"}}},"createdAt":"2022-07-15T00:48:55.914Z"}}},"createdAt":"2022-07-15T00:49:14.914Z"}	2024-06-07T12:43:11.025Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmapbv222	bafyreihth3a7rf7n34zk5dfqnxbaijjey52lznc6sr6xwu7tap7lu65az4	did:plc:zluht54hsscg6octtayzd3ft	{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreiajzithxxyp3pm5rzwxs4iz6ej4nfo7jj5y3uk77nxfd4o5hxjgza","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7wa4s22","value":{"text":"lol","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreihafcvgqpktxi7ugcwgfru5pm77due6skn6gkkqdq7jw7uodnzwxy","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6v7ic22","value":{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreidokrfnhzk5mnwcicnvw7cuorg2qgnpotk2vicwcuhxeua2cxwur4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6uky222","value":{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreibd6kqdmg5bvqvfme3nu76crz5hpdygbuvtfo5z6gmn73pm23c4bi","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6pppc22","value":{"text":"Wen token","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}}},"createdAt":"2022-07-15T00:47:46.914Z"}}},"createdAt":"2022-07-15T00:47:53.914Z"}}},"createdAt":"2022-07-15T00:47:54.914Z"}}},"createdAt":"2022-07-15T00:48:43.914Z"}}},"createdAt":"2022-07-15T00:49:16.914Z"}	2024-06-07T12:43:11.080Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmaqlus22	bafyreicoh73xyye3txq6ooqie3h5jv62zyt4mu362kvszxkxmczef6xu5u	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"What does this mean for pet owners in the midterms?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreidxjakkbifqysatmszjyvoa3usbnenyadx2dvxhebektepcvu4hry","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm66hx222","value":{"text":"These people need to go to a hospital.\\nWhat is it?\\nIt's a big place where sick people go, but that's not important right now.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:26.914Z"}},"parent":{"cid":"bafyreidxjakkbifqysatmszjyvoa3usbnenyadx2dvxhebektepcvu4hry","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm66hx222","value":{"text":"These people need to go to a hospital.\\nWhat is it?\\nIt's a big place where sick people go, but that's not important right now.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:26.914Z"}}},"createdAt":"2022-07-15T00:49:18.914Z"}	2024-06-07T12:43:11.122Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmatsg222	bafyreicsjstocs4sqjdobzetcacji4eawzizngrnuvdzsy5vdjvlyri4hm	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22"},"createdAt":"2022-07-15T00:49:24.914Z"}	2024-06-07T12:43:11.228Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmavbc222	bafyreiaxx24ae4ps5ugsiqrpdwnb7cg3osgzddhbpehjkc7tgr5ngtj5nq	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiahrxynudxg5rk76kw5mbcr65gjuli76szgmm3m3bso6ewxtkyngq","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64eks22"},"createdAt":"2022-07-15T00:49:27.914Z"}	2024-06-07T12:43:11.279Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmblm5222	bafyreidnhyhlewf4m3y3qp7wr6ch5n35b6qkhbpi4ulexdh3hhvs6b7f7y	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreibom4ih33aggpyno5jlmjlaxjybicxr3wcotkmaf4xqila67dnhhu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm74zic22"},"createdAt":"2022-07-15T00:50:07.914Z"}	2024-06-07T12:43:12.007Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7qz5222	bafyreihxtuaj4wfbyqjyswvscr5y7m7e7ojymxltfvrcyilg7z3yu5t7bi	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22","value":{"text":"Looks like I picked the wrong week to quit amphetamines.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:21.914Z"}},"parent":{"cid":"bafyreifsu7lckdjbk6tunuxynocyxwfcwafnjsysnyjqtxpse53jj3eyru","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm72ncs22","value":{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22","value":{"text":"Looks like I picked the wrong week to quit amphetamines.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:21.914Z"}},"parent":{"cid":"bafyreifyp6f7ouiz66iije43mepkmyo7balc4qnwohlyvb476rsin4ml7e","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm63wvc22","value":{"text":"Looks like I picked the wrong week to quit amphetamines.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:21.914Z"}}},"createdAt":"2022-07-15T00:48:02.914Z"}}},"createdAt":"2022-07-15T00:48:35.914Z"}	2024-06-07T12:43:10.088Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7sxn222	bafyreihnw6l32rjmtkvt5s56doimw5lfu2ymwfqftnlc2euhdcmmnlqnz4	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"Wen token","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreihwcj7qlqtq4iwyi7vez4bf4akjqjpeysaxqcoyzvg5dgvuzofip4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm75mzc22","value":{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreicyq7eldus5jwjulcgmbijfzkiqyfbnoo74fmowj5n2ydxqc4q7he","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22","value":{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}}},"createdAt":"2022-07-15T00:47:41.914Z"}}},"createdAt":"2022-07-15T00:48:07.914Z"}}},"createdAt":"2022-07-15T00:48:38.914Z"}	2024-06-07T12:43:10.153Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7uw5222	bafyreieouj26ubtzwd43olrtigwuhdlj4e555waytjfp65lp4wahvh6eva	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"What does this mean for pet owners in the midterms?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreiarkx6bnx7jvqoqbq7aozirex5v2356rf2zztbuuwxxfnn7ibqoly","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7jpqc22","value":{"text":"Wow, so true!","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreigytipb36mr5photttbnc7yrmy75tnwvcvohx3kg56vod5n522slq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6qxqk22","value":{"text":"is it cool if I DM?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreicyq7eldus5jwjulcgmbijfzkiqyfbnoo74fmowj5n2ydxqc4q7he","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22","value":{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}}},"createdAt":"2022-07-15T00:47:41.914Z"}}},"createdAt":"2022-07-15T00:47:48.914Z"}}},"createdAt":"2022-07-15T00:48:24.914Z"}}},"createdAt":"2022-07-15T00:48:41.914Z"}	2024-06-07T12:43:10.216Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7xk4k22	bafyreicbzb7gpl5n6syjqqzgix6cejwvmz7aquf2sgbkq7gt7zinc34s6y	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"Wen token","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}},"parent":{"cid":"bafyreihjmjhi6ovt77ffrwdttf4m2xmfi6ug5wczn2xccetuw2nj2racd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6zuvk22","value":{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}},"parent":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}}},"createdAt":"2022-07-15T00:48:01.914Z"}}},"createdAt":"2022-07-15T00:48:45.914Z"}	2024-06-07T12:43:10.309Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7zepk22	bafyreiavtz5pbqpzdwdns6cuk7tijrjueb7am77rdihyx3in5ytparccda	did:plc:zluht54hsscg6octtayzd3ft	{"text":"Wow, so true!","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreihafcvgqpktxi7ugcwgfru5pm77due6skn6gkkqdq7jw7uodnzwxy","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6v7ic22","value":{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreidokrfnhzk5mnwcicnvw7cuorg2qgnpotk2vicwcuhxeua2cxwur4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6uky222","value":{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreibd6kqdmg5bvqvfme3nu76crz5hpdygbuvtfo5z6gmn73pm23c4bi","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6pppc22","value":{"text":"Wen token","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}}},"createdAt":"2022-07-15T00:47:46.914Z"}}},"createdAt":"2022-07-15T00:47:53.914Z"}}},"createdAt":"2022-07-15T00:47:54.914Z"}}},"createdAt":"2022-07-15T00:48:47.914Z"}	2024-06-07T12:43:10.362Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma5enc22	bafyreifhrml2m2oqyue37mn2iwlsirdnpjues76yufy5invzhigguanita	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"This is sort of accurate, but honestly it misses a huge part of the issue at hand. There are just so many factors and I don't think a vibe is enough to cover it.","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreicwid24ntku3kmqruypwpgsdkpanhg2emvdvbkuvn3fmppxzlhdqa","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22","value":{"text":"Looks like I picked the wrong week to quit smoking.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:19.914Z"}},"parent":{"cid":"bafyreicwid24ntku3kmqruypwpgsdkpanhg2emvdvbkuvn3fmppxzlhdqa","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22","value":{"text":"Looks like I picked the wrong week to quit smoking.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:19.914Z"}}},"createdAt":"2022-07-15T00:48:53.914Z"}	2024-06-07T12:43:10.492Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma46kk22	bafyreicgt73gbvybblwvgog63c73uoyvzkiwpflu2zi2dbywpnafz3r7mi	did:plc:zluht54hsscg6octtayzd3ft	{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}},"parent":{"cid":"bafyreigiqmzmew4cu6eeualqhurezkrtsunelk3hnzpc7ot3o23lhornvq","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7p2n222","value":{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}},"parent":{"cid":"bafyreicho5whst5kg2exmu7jl4yk7iyihmpqqkvdqx2sa4tkitxsdxsrgu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7l2pc22","value":{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}},"parent":{"cid":"bafyreihjmjhi6ovt77ffrwdttf4m2xmfi6ug5wczn2xccetuw2nj2racd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6zuvk22","value":{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}},"parent":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}}},"createdAt":"2022-07-15T00:48:01.914Z"}}},"createdAt":"2022-07-15T00:48:26.914Z"}}},"createdAt":"2022-07-15T00:48:32.914Z"}}},"createdAt":"2022-07-15T00:48:51.914Z"}	2024-06-07T12:43:10.454Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7uank22	bafyreigb5ssh4mbqyaylhacmzhnt6oiltbpirhmqazmtbpswbfbysflgn4	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}},"parent":{"cid":"bafyreibs7cdwlfhlykogfpj5yimdk62ttoq5gn4akjk65zykistm4pk7cy","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6zbek22","value":{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}},"parent":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}}},"createdAt":"2022-07-15T00:48:00.914Z"}}},"createdAt":"2022-07-15T00:48:40.914Z"}	2024-06-07T12:43:10.194Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7vjo222	bafyreif3qimkdrmai7smpokzs7u5tx6uuwvf22xta7rvijwtcxyi2rao64	did:plc:zluht54hsscg6octtayzd3ft	{"text":"is it cool if I DM?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreidwwfbydjpoh5pm363uhfzdejxsuutwm4cpsv2ptht4x5q5ug22by","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm63k7222","value":{"text":"Looks like I picked the wrong week to quit drinking.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:20.914Z"}},"parent":{"cid":"bafyreigfwyy5uw74g2gkfilquplidccubgxpvdihuvwjnkag2iogetp5fu","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6m2jc22","value":{"text":"Wen token","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreidwwfbydjpoh5pm363uhfzdejxsuutwm4cpsv2ptht4x5q5ug22by","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm63k7222","value":{"text":"Looks like I picked the wrong week to quit drinking.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:20.914Z"}},"parent":{"cid":"bafyreidwwfbydjpoh5pm363uhfzdejxsuutwm4cpsv2ptht4x5q5ug22by","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm63k7222","value":{"text":"Looks like I picked the wrong week to quit drinking.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:20.914Z"}}},"createdAt":"2022-07-15T00:47:40.914Z"}}},"createdAt":"2022-07-15T00:48:42.914Z"}	2024-06-07T12:43:10.237Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7wa4s22	bafyreiajzithxxyp3pm5rzwxs4iz6ej4nfo7jj5y3uk77nxfd4o5hxjgza	did:plc:zluht54hsscg6octtayzd3ft	{"text":"lol","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreihafcvgqpktxi7ugcwgfru5pm77due6skn6gkkqdq7jw7uodnzwxy","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6v7ic22","value":{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreidokrfnhzk5mnwcicnvw7cuorg2qgnpotk2vicwcuhxeua2cxwur4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6uky222","value":{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreibd6kqdmg5bvqvfme3nu76crz5hpdygbuvtfo5z6gmn73pm23c4bi","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6pppc22","value":{"text":"Wen token","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}}},"createdAt":"2022-07-15T00:47:46.914Z"}}},"createdAt":"2022-07-15T00:47:53.914Z"}}},"createdAt":"2022-07-15T00:47:54.914Z"}}},"createdAt":"2022-07-15T00:48:43.914Z"}	2024-06-07T12:43:10.259Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7ymcc22	bafyreicdlrtocb5hivmgg5vfcas2bypsrk64dehthoqhjmkvl64o6kpgqy	did:plc:zluht54hsscg6octtayzd3ft	{"text":"a/s/l?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreia4smzotwpndfww2bxdmhqgovxq7pas5klmjwg2czsx2z6cv56e6m","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6t62k22","value":{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreigytipb36mr5photttbnc7yrmy75tnwvcvohx3kg56vod5n522slq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6qxqk22","value":{"text":"is it cool if I DM?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreicyq7eldus5jwjulcgmbijfzkiqyfbnoo74fmowj5n2ydxqc4q7he","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22","value":{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}}},"createdAt":"2022-07-15T00:47:41.914Z"}}},"createdAt":"2022-07-15T00:47:48.914Z"}}},"createdAt":"2022-07-15T00:47:51.914Z"}}},"createdAt":"2022-07-15T00:48:46.914Z"}	2024-06-07T12:43:10.339Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkma5z5k22	bafyreidtr62xflznx7wov2vsnlzhrosvckdvf4wxcxelae6psf45js2g7m	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"is it cool if I DM?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}},"parent":{"cid":"bafyreig63wu7skovixex2waesavh2ifjmbxbgohfggaag35kkmovwh2u7u","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7dqdc22","value":{"text":"What does this mean for pet owners in the midterms?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}},"parent":{"cid":"bafyreiaip7e3kif6rhhvkx4dckwbm3egog6sn7kkf4x5e2puj6d4lkit2m","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xaw222","value":{"text":"lol","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}},"parent":{"cid":"bafyreiazf5m4p3ly542yppowxjctwxq6bo7wqn3vxhwlw4zf6gafagjdmi","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6twhs22","value":{"text":"Wen token","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}},"parent":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}}},"createdAt":"2022-07-15T00:47:52.914Z"}}},"createdAt":"2022-07-15T00:47:57.914Z"}}},"createdAt":"2022-07-15T00:48:15.914Z"}}},"createdAt":"2022-07-15T00:48:54.914Z"}	2024-06-07T12:43:10.513Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma4s3k22	bafyreih6ycrwvvvewm65opmzr2w2bgbfza4o674talhlcddpixp5mf6mv4	did:plc:zluht54hsscg6octtayzd3ft	{"text":"Wow, so true!","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22","value":{"text":"I just want to tell you both good luck. We're all counting on you.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:27.914Z"}},"parent":{"cid":"bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22","value":{"text":"I just want to tell you both good luck. We're all counting on you.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:27.914Z"}}},"createdAt":"2022-07-15T00:48:52.914Z"}	2024-06-07T12:43:10.474Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmafobc22	bafyreickokrszbu3fyh7ebesnizvfq627h3hzsh5m2vkyjqqkx2ajidq2m	did:plc:zluht54hsscg6octtayzd3ft	{"text":"is it cool if I DM?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifed7rbzncumo543gdaydnaprdl2aokx725gk6cfruqimwngkfw2e","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6er4k22","value":{"text":"The life of everyone on board depends upon just one thing: finding someone back there who can not only fly this plane, but who didn't have fish for dinner.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:35.914Z"}},"parent":{"cid":"bafyreifed7rbzncumo543gdaydnaprdl2aokx725gk6cfruqimwngkfw2e","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6er4k22","value":{"text":"The life of everyone on board depends upon just one thing: finding someone back there who can not only fly this plane, but who didn't have fish for dinner.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:35.914Z"}}},"createdAt":"2022-07-15T00:49:04.914Z"}	2024-06-07T12:43:10.767Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7wtns22	bafyreihgh57cwdh3kywwadabvhnfpfrsvhmuugl5otz4xfsgsja7uhv2qm	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"This is sort of accurate, but honestly it misses a huge part of the issue at hand. There are just so many factors and I don't think a vibe is enough to cover it.","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}},"parent":{"cid":"bafyreihjmjhi6ovt77ffrwdttf4m2xmfi6ug5wczn2xccetuw2nj2racd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6zuvk22","value":{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}},"parent":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}}},"createdAt":"2022-07-15T00:48:01.914Z"}}},"createdAt":"2022-07-15T00:48:44.914Z"}	2024-06-07T12:43:10.280Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma3k2c22	bafyreiaw2qpwzp6x6jlx5rzzknelrsajqi2titcwmji625na6xcglyiv4q	did:plc:zluht54hsscg6octtayzd3ft	{"text":"This is sort of accurate, but honestly it misses a huge part of the issue at hand. There are just so many factors and I don't think a vibe is enough to cover it.","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreia4smzotwpndfww2bxdmhqgovxq7pas5klmjwg2czsx2z6cv56e6m","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6t62k22","value":{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreigytipb36mr5photttbnc7yrmy75tnwvcvohx3kg56vod5n522slq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6qxqk22","value":{"text":"is it cool if I DM?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreicyq7eldus5jwjulcgmbijfzkiqyfbnoo74fmowj5n2ydxqc4q7he","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6mozk22","value":{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}}},"createdAt":"2022-07-15T00:47:41.914Z"}}},"createdAt":"2022-07-15T00:47:48.914Z"}}},"createdAt":"2022-07-15T00:47:51.914Z"}}},"createdAt":"2022-07-15T00:48:50.914Z"}	2024-06-07T12:43:10.432Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma6pmc22	bafyreicocopqz3vmrs7ndsx7l7rnph3sqpdoshml7f6vx4m2klvzkjpa24	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"fire","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}},"parent":{"cid":"bafyreibc6lqv5cla3g6xfubafiwapmfzvgbakgfwgcwcjkiwpaj4wyooqm","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7mcqk22","value":{"text":"a/s/l?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}},"parent":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}}},"createdAt":"2022-07-15T00:48:28.914Z"}}},"createdAt":"2022-07-15T00:48:55.914Z"}	2024-06-07T12:43:10.539Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmaa4js22	bafyreiad2yqm6qwrpshalzscz644qp3osayprmcddvhwo2dywiqffrm2bi	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"Wow, so true!","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreicwid24ntku3kmqruypwpgsdkpanhg2emvdvbkuvn3fmppxzlhdqa","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22","value":{"text":"Looks like I picked the wrong week to quit smoking.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:19.914Z"}},"parent":{"cid":"bafyreifhrml2m2oqyue37mn2iwlsirdnpjues76yufy5invzhigguanita","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma5enc22","value":{"text":"This is sort of accurate, but honestly it misses a huge part of the issue at hand. There are just so many factors and I don't think a vibe is enough to cover it.","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreicwid24ntku3kmqruypwpgsdkpanhg2emvdvbkuvn3fmppxzlhdqa","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22","value":{"text":"Looks like I picked the wrong week to quit smoking.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:19.914Z"}},"parent":{"cid":"bafyreicwid24ntku3kmqruypwpgsdkpanhg2emvdvbkuvn3fmppxzlhdqa","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22","value":{"text":"Looks like I picked the wrong week to quit smoking.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:19.914Z"}}},"createdAt":"2022-07-15T00:48:53.914Z"}}},"createdAt":"2022-07-15T00:48:57.914Z"}	2024-06-07T12:43:10.584Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmaeaek22	bafyreihkzh7ny5yrxqemvybg3i7777fj7mfnde6xeyrt4wmxjs5rljgoge	did:plc:zluht54hsscg6octtayzd3ft	{"text":"is it cool if I DM?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}},"parent":{"cid":"bafyreihjmjhi6ovt77ffrwdttf4m2xmfi6ug5wczn2xccetuw2nj2racd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6zuvk22","value":{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}},"parent":{"cid":"bafyreiao5q53xah34uiwhehey3r77yzdsaqufaji6yw2fzckf775fdetbu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6d7cs22","value":{"text":"What was it we had for dinner tonight?\\nWell, we had a choice of steak or fish.\\nYes, yes, I remember, I had lasagna.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:32.914Z"}}},"createdAt":"2022-07-15T00:48:01.914Z"}}},"createdAt":"2022-07-15T00:49:02.914Z"}	2024-06-07T12:43:10.719Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmaweh222	bafyreideunwwwbmgynidmrn3iopxf7s5jrquyu6ay6f2wuhqdvyd5r5tta	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreidwj4haslqlsrycp5uc2kaoupd5vbgaoxzsxzbwwydcguec4catcu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65frc22"},"createdAt":"2022-07-15T00:49:29.914Z"}	2024-06-07T12:43:11.313Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmaexsk22	bafyreia25f2teavzep54pf5lpmj2c5cstertmc6uzsit6vt72k7bqlb4cm	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"is it cool if I DM?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}},"parent":{"cid":"bafyreifq5qlna56dx6aidinn3nwcqeszis3vguxz4t5vgkjrpdppeht2by","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm65xds22","value":{"text":"Joey, have you ever been in a turkish prison?","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:25.914Z"}}},"createdAt":"2022-07-15T00:49:03.914Z"}	2024-06-07T12:43:10.741Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmaj7kc22	bafyreic5guwbepjlbejxy5lpjcmnkjgkbjn5bdtyp3hy6uzr57hyev2ify	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"What does this mean for pet owners in the midterms?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreicwid24ntku3kmqruypwpgsdkpanhg2emvdvbkuvn3fmppxzlhdqa","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22","value":{"text":"Looks like I picked the wrong week to quit smoking.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:19.914Z"}},"parent":{"cid":"bafyreicwid24ntku3kmqruypwpgsdkpanhg2emvdvbkuvn3fmppxzlhdqa","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22","value":{"text":"Looks like I picked the wrong week to quit smoking.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:19.914Z"}}},"createdAt":"2022-07-15T00:49:08.914Z"}	2024-06-07T12:43:10.883Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmam7as22	bafyreidnh6h34yqwjgg65zdxkd35jms6vggpkc3abjojoy2bjcrmbb3f6i	did:plc:zluht54hsscg6octtayzd3ft	{"text":"Haha ikr","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreiahz6chrakkw7en4ceothts6uyxlualmbsgaaaruneiouc4t4uqa4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmac3z222","value":{"text":"is it cool if I DM?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}},"parent":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22","value":{"text":"Nervous?\\nYes. Very.\\nFirst time?\\nNo, I've been nervous lots of times.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:17.914Z"}}},"createdAt":"2022-07-15T00:48:59.914Z"}}},"createdAt":"2022-07-15T00:49:12.914Z"}	2024-06-07T12:43:10.980Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmaxz6k22	bafyreicybv3yh4ct7jxsftjcnb6rsxv5g7zsnx3v4ebe2fr7hx32s7sru4	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22"},"createdAt":"2022-07-15T00:49:32.914Z"}	2024-06-07T12:43:11.366Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmazmws22	bafyreib34xvqst3kwka5cvzqajl7wmif6hyh6rspd23yndilzqm4zkkery	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiceit7gbs5xammejxeej665pnliyxyogmf4fqkvmakundsmd7mooe","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6bhnk22"},"createdAt":"2022-07-15T00:49:35.914Z"}	2024-06-07T12:43:11.419Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmb2m6s22	bafyreig5abqx2bk23juysvt43yezs6prgabsei5paoncb3syt347nf73f4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22"},"createdAt":"2022-07-15T00:49:37.914Z"}	2024-06-07T12:43:11.451Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmb3lgs22	bafyreibrpb73tegzpxfj7gsitxxix67c7gtnpvkt3oka2g3n6omzfcpkea	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreifed7rbzncumo543gdaydnaprdl2aokx725gk6cfruqimwngkfw2e","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6er4k22"},"createdAt":"2022-07-15T00:49:39.914Z"}	2024-06-07T12:43:11.486Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmb4ols22	bafyreieslouhakj57ncxbfbaostrjusizn6qu6ylcxlozredalejwycuaa	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiarenp2r55zrv52fnig3wyttvdcluenvbu2m3oqte7qn4js54f5dq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6lgyc22"},"createdAt":"2022-07-15T00:49:41.914Z"}	2024-06-07T12:43:11.519Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmb6p2c22	bafyreid3acqebze55x7m74nuro2w75aiedkfelpxb4zb32xjudevqszpom	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreibbfl3v22jf4vneuwi3wy73d3t2xnqdc4cnb6dqhh4oxwqf6xuxsm","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ndjs22"},"createdAt":"2022-07-15T00:49:45.914Z"}	2024-06-07T12:43:11.585Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbctuc22	bafyreidvq4gvnuv4xljymgksp3nycmb7hu7abllqx23nfkm7tjgblgxsxq	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreih5bwjxfretqbmnmtnh2nmfoxrugkrsydmgo73izz26k64mxtxshy","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6sar222"},"createdAt":"2022-07-15T00:49:51.914Z"}	2024-06-07T12:43:11.725Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbears22	bafyreievpmbxokg5kzhvgjqjzlgx3pjgn5mhv2wyta4t4k6nd2aasijoxq	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiaip7e3kif6rhhvkx4dckwbm3egog6sn7kkf4x5e2puj6d4lkit2m","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xaw222"},"createdAt":"2022-07-15T00:49:53.914Z"}	2024-06-07T12:43:11.769Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbi3tc22	bafyreih3hpi3al2jzpylkosfoeugbwnytdmvgnbjutu44qltv7mbitecj4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreih3vtpmaliuufzvmvp2xh74kgwpnnam7axm3c24o6besdvqzg3bg4","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm73bt222"},"createdAt":"2022-07-15T00:50:00.914Z"}	2024-06-07T12:43:11.893Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbkmv222	bafyreigkg4uyc27qgxcguhpvkey26h6nyri2dpifgetb6d3buamv7cnivq	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreibom4ih33aggpyno5jlmjlaxjybicxr3wcotkmaf4xqila67dnhhu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm74zic22"},"createdAt":"2022-07-15T00:50:05.914Z"}	2024-06-07T12:43:11.976Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmagjmc22	bafyreiapglbozxgvrngr3i56brbaukc5udsdbwsmmp7axguqscbtavuz6m	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"is it cool if I DM?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}},"parent":{"cid":"bafyreih5bwjxfretqbmnmtnh2nmfoxrugkrsydmgo73izz26k64mxtxshy","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6sar222","value":{"text":"lol","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}},"parent":{"cid":"bafyreid2w2wi55ko3m3lcj6puvrywdcfey2dapgg2raddqvcjq5jxkw6be","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6p55k22","value":{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}},"parent":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}}},"createdAt":"2022-07-15T00:47:45.914Z"}}},"createdAt":"2022-07-15T00:47:50.914Z"}}},"createdAt":"2022-07-15T00:49:05.914Z"}	2024-06-07T12:43:10.796Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmamvpk22	bafyreigzm756fmbrj22rhawr7cojojnc7g3bu32rzjw6armvhpfjvvkgz4	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}},"parent":{"cid":"bafyreiapglbozxgvrngr3i56brbaukc5udsdbwsmmp7axguqscbtavuz6m","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmagjmc22","value":{"text":"is it cool if I DM?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}},"parent":{"cid":"bafyreih5bwjxfretqbmnmtnh2nmfoxrugkrsydmgo73izz26k64mxtxshy","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6sar222","value":{"text":"lol","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}},"parent":{"cid":"bafyreid2w2wi55ko3m3lcj6puvrywdcfey2dapgg2raddqvcjq5jxkw6be","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6p55k22","value":{"text":"ugh when will hashtags get supported in this app","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}},"parent":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22","value":{"text":"Jim never vomits at home.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:33.914Z"}}},"createdAt":"2022-07-15T00:47:45.914Z"}}},"createdAt":"2022-07-15T00:47:50.914Z"}}},"createdAt":"2022-07-15T00:49:05.914Z"}}},"createdAt":"2022-07-15T00:49:13.914Z"}	2024-06-07T12:43:11.003Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmaig5s22	bafyreihjk3euvxnwb34irk5rszmtai57cv5zayb6tdffswiljtylv6xu6y	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"Haha ikr","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}},"parent":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}}},"createdAt":"2022-07-15T00:49:07.914Z"}	2024-06-07T12:43:10.857Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmajvz222	bafyreibcdzdfzu6gp6maiw2aopnyop6njhp4z7s4gtdy4paifyngjcfnze	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"What does this mean for pet owners in the midterms?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreibl6nrxujzusdkawwdxoegdgbysqt3wu7xrpimtyeqij4ldrdpvt4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm5zpm222","value":{"text":"I am serious...and don't call me Shirley.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:18.914Z"}},"parent":{"cid":"bafyreibl6nrxujzusdkawwdxoegdgbysqt3wu7xrpimtyeqij4ldrdpvt4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm5zpm222","value":{"text":"I am serious...and don't call me Shirley.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:18.914Z"}}},"createdAt":"2022-07-15T00:49:09.914Z"}	2024-06-07T12:43:10.909Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmao7pc22	bafyreiaagbmljfnqkwpppijmq2rc5ld25ohrvvcsyw2ilzbsvz5wqdh5l4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"text":"a/s/l?","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}},"parent":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22","value":{"text":"Captain, how soon can we land?\\nI can't tell.\\nYou can tell me, I'm a doctor.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:23.914Z"}}},"createdAt":"2022-07-15T00:49:15.914Z"}	2024-06-07T12:43:11.045Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmapzd222	bafyreid3xstgek64pqr2zq6bohxi4vkfqmyr7e4wjsprguho5av3oz4ec4	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"text":"Haha ikr","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22","value":{"text":"I just want to tell you both good luck. We're all counting on you.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:27.914Z"}},"parent":{"cid":"bafyreih6ycrwvvvewm65opmzr2w2bgbfza4o674talhlcddpixp5mf6mv4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma4s3k22","value":{"text":"Wow, so true!","$type":"app.bsky.feed.post","reply":{"root":{"cid":"bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22","value":{"text":"I just want to tell you both good luck. We're all counting on you.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:27.914Z"}},"parent":{"cid":"bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22","value":{"text":"I just want to tell you both good luck. We're all counting on you.","$type":"app.bsky.feed.post","createdAt":"2022-07-15T00:47:27.914Z"}}},"createdAt":"2022-07-15T00:48:52.914Z"}}},"createdAt":"2022-07-15T00:49:17.914Z"}	2024-06-07T12:43:11.103Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmas7n222	bafyreih62t2lumuzt33dvegh4s2crnblumru5gllko4rfphn25lbo4s7ja	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22"},"createdAt":"2022-07-15T00:49:21.914Z"}	2024-06-07T12:43:11.179Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmauro222	bafyreieofchcqoyt5go7hu2fhuprgcvltgoiqawrsbl5eprxs7o7xg6sbq	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiahrxynudxg5rk76kw5mbcr65gjuli76szgmm3m3bso6ewxtkyngq","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64eks22"},"createdAt":"2022-07-15T00:49:26.914Z"}	2024-06-07T12:43:11.261Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmavut222	bafyreianjkzgikv2tdrwsqhmmhtvziwrfa2l3i2eay5sauxyzrc33iibgu	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreibgw52xm7ovvj3ujbasw3h3xqurp6hhlxeiaehqr7vxsx4kqu74mu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm64t7k22"},"createdAt":"2022-07-15T00:49:28.914Z"}	2024-06-07T12:43:11.295Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmb33ss22	bafyreicsma5f6scg2tqsq5z3geinqacadaqm7xfnlrrbzuhzxatuwgrcja	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiezc2wqu4ljhwhoxnpc7wp5odb5qhm5aeztl4gysb2rhylu2dycg4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6dows22"},"createdAt":"2022-07-15T00:49:38.914Z"}	2024-06-07T12:43:11.467Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmb45yk22	bafyreibo4dya4aa5vum2oktcrw3ehdi3dkgsmorp5kkqzahk2zuauyuk2a	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreifsazs5bwjay324fnkz5ecluwy4bpehh5iwdkwmerj7ywhjj7pcnq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6ides22"},"createdAt":"2022-07-15T00:49:40.914Z"}	2024-06-07T12:43:11.502Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmb5muk22	bafyreiepq3tvbikvzncv25vluhtvhy2qsw74v3ltxap3oozscyf6zwmpem	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiarenp2r55zrv52fnig3wyttvdcluenvbu2m3oqte7qn4js54f5dq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6lgyc22"},"createdAt":"2022-07-15T00:49:43.914Z"}	2024-06-07T12:43:11.550Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmb65hs22	bafyreibkl6rfkjkgtttdoncaciebbicobytcmovzuqxkuq5lez5of3lbb4	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreigfwyy5uw74g2gkfilquplidccubgxpvdihuvwjnkag2iogetp5fu","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6m2jc22"},"createdAt":"2022-07-15T00:49:44.914Z"}	2024-06-07T12:43:11.566Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbbzik22	bafyreigqdgpom4au2ojuw5ciyg3qv4ndq4cez76iwwnukwolwfxf2ysk2a	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreigytipb36mr5photttbnc7yrmy75tnwvcvohx3kg56vod5n522slq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6qxqk22"},"createdAt":"2022-07-15T00:49:50.914Z"}	2024-06-07T12:43:11.702Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbftks22	bafyreib2f4wydqjqjajesllltoajse7ctcxs5um7l2d243wd3xeg4de7jq	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreibs7cdwlfhlykogfpj5yimdk62ttoq5gn4akjk65zykistm4pk7cy","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6zbek22"},"createdAt":"2022-07-15T00:49:56.914Z"}	2024-06-07T12:43:11.819Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbj33c22	bafyreicvalqrqqxszs4ltyijajs4lfsdboeyxq6psljrwmso3d3uoypu34	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreigntykfl6qep45vt6wq46qrs7huq5opddpw5z2glomc24p2mdfjty","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm73ues22"},"createdAt":"2022-07-15T00:50:02.914Z"}	2024-06-07T12:43:11.925Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbk5b222	bafyreiamlvybm2jnvkvivby2v7ynan6xipqxmmyags4ohqae2fbu52tx7i	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreibjfpn3ozc6rjzkjytahzatd77uarqqnnswivuvi2suhdycsmcflu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm74gwk22"},"createdAt":"2022-07-15T00:50:04.914Z"}	2024-06-07T12:43:11.960Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbl5ic22	bafyreifr45svqe53muz7hu6ycgrkuwbcfbj2qqdu45ckiuy6yiiu26swju	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreibom4ih33aggpyno5jlmjlaxjybicxr3wcotkmaf4xqila67dnhhu","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm74zic22"},"createdAt":"2022-07-15T00:50:06.914Z"}	2024-06-07T12:43:11.992Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbba4222	bafyreiajjhrxsx5k3w2mko5rpkkkxj25mxfevrusu5xja47hbrxhgrr4cy	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreideidtqpviy6deov3hiv2bph4ngud6snrf3rqj62e7n56me3accuy","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6qcb222"},"createdAt":"2022-07-15T00:49:49.914Z"}	2024-06-07T12:43:11.676Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbgznk22	bafyreihe257r3gmtdugqo6rhcy3rkttclqq5zodrr27wl54bah7hadvpm4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreifsu7lckdjbk6tunuxynocyxwfcwafnjsysnyjqtxpse53jj3eyru","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm72ncs22"},"createdAt":"2022-07-15T00:49:58.914Z"}	2024-06-07T12:43:11.859Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbhla222	bafyreifsmcuz7vhe33xmxwxhjfdmi3ejt3yskiqoxoghysxm6f6upvhfiu	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreih3vtpmaliuufzvmvp2xh74kgwpnnam7axm3c24o6besdvqzg3bg4","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm73bt222"},"createdAt":"2022-07-15T00:49:59.914Z"}	2024-06-07T12:43:11.876Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbilhc22	bafyreidk5aescftg3msca2e5njfqkygob7wh32jx4ujn6qtrjmwunlnrlu	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreigntykfl6qep45vt6wq46qrs7huq5opddpw5z2glomc24p2mdfjty","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm73ues22"},"createdAt":"2022-07-15T00:50:01.914Z"}	2024-06-07T12:43:11.909Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbm2rs22	bafyreihz4t4xhrgrd5jumlfe5ippvtwxi7yyjjtarwo3mat4iqtx6p4pje	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreihwcj7qlqtq4iwyi7vez4bf4akjqjpeysaxqcoyzvg5dgvuzofip4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm75mzc22"},"createdAt":"2022-07-15T00:50:08.914Z"}	2024-06-07T12:43:12.023Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbob3s22	bafyreibadqwgadjly75stbccw6zkgw5rjqut6x72zmijhkjuabspmezzpi	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreie5deuo4q3cbbfcms72ew3fhnpljyclzrqfc7ybathfcj54lyqu4e","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7awic22"},"createdAt":"2022-07-15T00:50:12.914Z"}	2024-06-07T12:43:12.095Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbqw2k22	bafyreicrgqiemo3pt7aiupib7af65oyhtg7fchkwzr3tl4espfljybvc5e	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreicktcft44xal23bti6zihdlbldfrjii7r3zuro5djfbdmmrle5rem","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7eetk22"},"createdAt":"2022-07-15T00:50:17.914Z"}	2024-06-07T12:43:12.182Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbsmqk22	bafyreigsjjhuwmm6nbup7uxrni5i5lxrsbaymhzprs2hquqrrtmz4tivcq	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiat6kavehlet5nmwsgctjpeukavhtkalikajn54efgle2mmv2opzu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7hles22"},"createdAt":"2022-07-15T00:50:20.914Z"}	2024-06-07T12:43:12.237Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbu3mk22	bafyreiahifws4jvb77spn5azueio26ujbfrfazyt6rggpeofcqsmalilfi	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreih3yrxva7euqbsiozt473ou6giubfjq5dujecdoehkr7vuggkfxsu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7j2as22"},"createdAt":"2022-07-15T00:50:23.914Z"}	2024-06-07T12:43:12.286Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmcawqs22	bafyreifbq2kqyck55zdzl56etzoagrl3fxdscx23bfbqdubwusj5rye3mq	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiajzithxxyp3pm5rzwxs4iz6ej4nfo7jj5y3uk77nxfd4o5hxjgza","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7wa4s22"},"createdAt":"2022-07-15T00:50:47.914Z"}	2024-06-07T12:43:12.708Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcdbx222	bafyreie6nm4mdx5hin3d3f5mhqt7icuvhxvrqw3pz2rapw6qwgv4al7esm	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiezftduzsjzbgjfyxkli3vbre3jybpgkilyvpfnhfoxfjthry3byy","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma227222"},"createdAt":"2022-07-15T00:50:51.914Z"}	2024-06-07T12:43:12.786Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmcgrbk22	bafyreidzhif23rfvszfyfvmvaya343vimx5ipzg5zdzafa2u5afvsmlodq	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreicocopqz3vmrs7ndsx7l7rnph3sqpdoshml7f6vx4m2klvzkjpa24","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma6pmc22"},"createdAt":"2022-07-15T00:50:57.914Z"}	2024-06-07T12:43:12.902Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmcjuv222	bafyreigetbwhgwrdaoq5y2inazxf26gu7nxhhm3qop56d5e4trrsu6wz6i	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiccumm4iihqjafzdjj4lhtzwusrwnuefibe4nm3ja337y7zwoqmse","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmadluc22"},"createdAt":"2022-07-15T00:51:02.914Z"}	2024-06-07T12:43:13.000Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmcmjts22	bafyreihwxolbkbesf4vqlrrqorl5qcl3p5ksgler4lpzr5w3wjs4u2dm4a	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiazaf56e45jmxntxyybs6hvwujxn4t23nf25oa76nzrn43jnlctoy","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmahcys22"},"createdAt":"2022-07-15T00:51:07.914Z"}	2024-06-07T12:43:13.087Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcp5tc22	bafyreiefl4mx337teehxvlt5bmgsdjsbce5wtekzebh4hq4g3v7gz5vwga	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreibcdzdfzu6gp6maiw2aopnyop6njhp4z7s4gtdy4paifyngjcfnze","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmajvz222"},"createdAt":"2022-07-15T00:51:12.914Z"}	2024-06-07T12:43:13.173Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmcwafc22	bafyreickb46dva6cu6clpqj7hau7fyqlwkevdllhkwwjcxdif3c675opii	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreicoh73xyye3txq6ooqie3h5jv62zyt4mu362kvszxkxmczef6xu5u","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmaqlus22"},"createdAt":"2022-07-15T00:51:23.914Z"}	2024-06-07T12:43:13.410Z	\N
at://did:plc:vb63kualusarrqqejvolrrv7/app.bsky.actor.profile/self	bafyreif23tsmsrb5cvcojficzobr57lbc4ilf4xmzegf7hexnzeggmpz3q	did:plc:vb63kualusarrqqejvolrrv7	{"$type":"app.bsky.actor.profile","description":"Labeling things across the atmosphere","displayName":"Test Labeler"}	2024-06-07T12:43:13.693Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbdhfc22	bafyreifx5hffy7oszkdtz2k5fcw6h6vw74qdndylu473kjybmtrw2wrqpq	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreigfuziopyoqcyv5jx6n7farmuxqmt6o3eeyszctl2xveyahtucnhe","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm6wiis22"},"createdAt":"2022-07-15T00:49:52.914Z"}	2024-06-07T12:43:11.751Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbetdk22	bafyreierhbxeyiomuyl2pntpfkme4linj37udscjgvfpzjyvspkmmow4ge	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreidqo3vj5ry5kvsm4srfutz27dtzkmqdzcq7sxouhcmxslcybcqf4m","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6xxes22"},"createdAt":"2022-07-15T00:49:54.914Z"}	2024-06-07T12:43:11.787Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbfdws22	bafyreie6sxgclduizm4ra7eiylo3ktop3eclglekimm2oi2ep6jzgbgl5m	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreifet3tq7lfikiwmcbp4puqxs5vl35otyg4skzvqdjjtq75juzazxq","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm6yoss22"},"createdAt":"2022-07-15T00:49:55.914Z"}	2024-06-07T12:43:11.803Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbgf5c22	bafyreicieje66isblikhgjer6wsila2sta7ocqln4ykubhv3ewojuxymae	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreifsu7lckdjbk6tunuxynocyxwfcwafnjsysnyjqtxpse53jj3eyru","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm72ncs22"},"createdAt":"2022-07-15T00:49:57.914Z"}	2024-06-07T12:43:11.841Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbjmns22	bafyreigvoziqloafdu3gpobmbrnjp4jnhjob7cxb5cfurhdod7ei3pvrgq	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreibjfpn3ozc6rjzkjytahzatd77uarqqnnswivuvi2suhdycsmcflu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm74gwk22"},"createdAt":"2022-07-15T00:50:03.914Z"}	2024-06-07T12:43:11.943Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbn3yc22	bafyreibkxjdp5btj3ocntytbtafptri4aknszjfsjqrmwxmjpm25s66ima	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreict3zjalmndopvzm4rd5nzx2lz3spqnphfzifmoz7f3odke2jqptq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm76di222"},"createdAt":"2022-07-15T00:50:10.914Z"}	2024-06-07T12:43:12.059Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbpbd222	bafyreib67mnowvk7y6wlntvuxtvt4mfseo55lrqmfw27lsew3pp2te5e4i	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreigzrkdypcw6rzkdswhct6ay552cpzukzcfmrdxdhfi4tx2bfg3yaq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7blxs22"},"createdAt":"2022-07-15T00:50:14.914Z"}	2024-06-07T12:43:12.130Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbxtqc22	bafyreihwzexrvlhtoeuyvvpageidw6grcbeye4r7hv5f2h47gipl6a76ve	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreifktbxrueu6rfzzmsva4wn6cso23x4qrxcjqgrrk4f6upo4t6dd2m","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7npo222"},"createdAt":"2022-07-15T00:50:30.914Z"}	2024-06-07T12:43:12.409Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbzt7k22	bafyreih5oe3p2wvmax4sukn34j3jw3jds6u6jdujwgi2fa7fx4ycxiq5se	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreigvlrrozbjn3gxkcp44pspjbmtawgdxjw7qytnv2ts3rtqzgvpsqy","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7pn6s22"},"createdAt":"2022-07-15T00:50:34.914Z"}	2024-06-07T12:43:12.475Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmc2ug222	bafyreig7fe35orakwfc2t3zhfknjqo5tftp47ehx7puq6jvmombjnppt4e	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreihxtuaj4wfbyqjyswvscr5y7m7e7ojymxltfvrcyilg7z3yu5t7bi","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7qz5222"},"createdAt":"2022-07-15T00:50:36.914Z"}	2024-06-07T12:43:12.511Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmc56n222	bafyreihmavkyedlmpk3dybwwupuzgqx3pkaou6djlbcr42avxnr44ntgje	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreifl3toeqtvxgbdmp6ov6mcxxivj2entj66xn4x4kfvpp42m7gqr5q","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7rkpk22"},"createdAt":"2022-07-15T00:50:40.914Z"}	2024-06-07T12:43:12.586Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmc5q7k22	bafyreibk3c5minu5ybaermatnhg7rua4wywopjloddn2f7cqwloqyav36a	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreihnw6l32rjmtkvt5s56doimw5lfu2ymwfqftnlc2euhdcmmnlqnz4","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7sxn222"},"createdAt":"2022-07-15T00:50:41.914Z"}	2024-06-07T12:43:12.603Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmccqek22	bafyreibhfjtjo6el5sfekkfdam2umf2bpj7yqrlr3x4h4tht7klkchkn7y	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiavtz5pbqpzdwdns6cuk7tijrjueb7am77rdihyx3in5ytparccda","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7zepk22"},"createdAt":"2022-07-15T00:50:50.914Z"}	2024-06-07T12:43:12.768Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmci4ak22	bafyreiag56ggmemivkgvmx7ev23bkpquj2lp47v2x7qn5gtq7clvao4zri	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiad2yqm6qwrpshalzscz644qp3osayprmcddvhwo2dywiqffrm2bi","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmaa4js22"},"createdAt":"2022-07-15T00:50:59.914Z"}	2024-06-07T12:43:12.943Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmcmzhs22	bafyreic6qxlw5thajfh25gasly7g6g6u75bzijcswn75pet2cl3wz7lvbm	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiazaf56e45jmxntxyybs6hvwujxn4t23nf25oa76nzrn43jnlctoy","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmahcys22"},"createdAt":"2022-07-15T00:51:08.914Z"}	2024-06-07T12:43:13.104Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmcrnvs22	bafyreibadnb666cxta3b3brvr74bpllyy6gxmcjsl4xk6tvnfuykhyme2i	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiaagbmljfnqkwpppijmq2rc5ld25ohrvvcsyw2ilzbsvz5wqdh5l4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmao7pc22"},"createdAt":"2022-07-15T00:51:16.914Z"}	2024-06-07T12:43:13.258Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcthjk22	bafyreibj6tu3zd2tqme5ivwublwrnwwb2sts5uriiv2riqzi7lyam7fqp4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreihth3a7rf7n34zk5dfqnxbaijjey52lznc6sr6xwu7tap7lu65az4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmapbv222"},"createdAt":"2022-07-15T00:51:19.914Z"}	2024-06-07T12:43:13.315Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbmmec22	bafyreiek5nv7z3a35mvontvizqjjy7azdabuvenlsoweybc5wxgx7rpwim	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreihwcj7qlqtq4iwyi7vez4bf4akjqjpeysaxqcoyzvg5dgvuzofip4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm75mzc22"},"createdAt":"2022-07-15T00:50:09.914Z"}	2024-06-07T12:43:12.041Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbnpjc22	bafyreif7szdvxfhehikrqw2ntnlsmigsjrfofzeovi4pzjaf2ss2wj7ggq	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreifxrysbjhvhafppbgxwgg6tm6ye4iq56d6wft5ivjo6tyu7yke3be","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm77cq222"},"createdAt":"2022-07-15T00:50:11.914Z"}	2024-06-07T12:43:12.079Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmboqps22	bafyreiamhuf5lstkinfwxd476b6523xpxnto6iujaeklqqukrg5foi6nzy	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreie5deuo4q3cbbfcms72ew3fhnpljyclzrqfc7ybathfcj54lyqu4e","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7awic22"},"createdAt":"2022-07-15T00:50:13.914Z"}	2024-06-07T12:43:12.111Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbqei222	bafyreifnhvf3q5vrsve4jf3ibfw2u4ga56nzf5g6uinht6bosudtdt3drm	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreig63wu7skovixex2waesavh2ifjmbxbgohfggaag35kkmovwh2u7u","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7dqdc22"},"createdAt":"2022-07-15T00:50:16.914Z"}	2024-06-07T12:43:12.164Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbrfok22	bafyreihzed2l3txajnevmpai5vol55pmgkdmz5msukfodpdfbusmy7heeq	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreibw5y2w5tkkh3lwespoggcetavx2pmxnm6owicueqocrppxeftokq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7gafs22"},"createdAt":"2022-07-15T00:50:18.914Z"}	2024-06-07T12:43:12.201Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbrz7k22	bafyreidwyiihnh32y3l52x7thzonhoxjub5upzei3gzyvvkrajqlh2qdz4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiglrva5gmt5mumpuj55c2wxbnknijfsztiz6n7imalmlv63a4bhk4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7gvvc22"},"createdAt":"2022-07-15T00:50:19.914Z"}	2024-06-07T12:43:12.221Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbuzvc22	bafyreigwerbfwqa6i4cyelqoglubu3dpizt356zien253iqbw6j3ajqgh4	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreib5eet7fqeo3c7yujtnsvudsfcb44tmzxhcvxa6ogev2q6t5yfa5q","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7keak22"},"createdAt":"2022-07-15T00:50:25.914Z"}	2024-06-07T12:43:12.318Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbwaxc22	bafyreihbspp5xbc6ml5gfceyxtw45dep5wxvfeebqfeionivw4cij2lbea	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreibc6lqv5cla3g6xfubafiwapmfzvgbakgfwgcwcjkiwpaj4wyooqm","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7mcqk22"},"createdAt":"2022-07-15T00:50:27.914Z"}	2024-06-07T12:43:12.358Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbzdlk22	bafyreib3avs2qv6j44uxiubwqvt7h3v6b2mch5efukryvoumm4tycyq7tq	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreigiqmzmew4cu6eeualqhurezkrtsunelk3hnzpc7ot3o23lhornvq","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7p2n222"},"createdAt":"2022-07-15T00:50:33.914Z"}	2024-06-07T12:43:12.458Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbycf222	bafyreihf724omxuzdd4lxfn4ohoxvyjumhwt6iaxgumvq2czxujjl2tlzi	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreibjpq4ipgtmol5ckai6544ipyqmvevvjakzc4x46ac3jhfyrm7gfy","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7of5k22"},"createdAt":"2022-07-15T00:50:31.914Z"}	2024-06-07T12:43:12.424Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmcag5k22	bafyreid4j3voeon6nicjjzx3xkcohqlzajyumgupf7uuucid54mjoe5zyy	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreif3qimkdrmai7smpokzs7u5tx6uuwvf22xta7rvijwtcxyi2rao64","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7vjo222"},"createdAt":"2022-07-15T00:50:46.914Z"}	2024-06-07T12:43:12.691Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmcdtjk22	bafyreifiziaxzag2oggjdnxqfc7vdcxqi7dflysktlxavasgubf23is2gi	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreidnyqv4p7iwm2tuoi7pfhkqpa3qwwwjsubu6tjxzwianersoc22qi","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma2qns22"},"createdAt":"2022-07-15T00:50:52.914Z"}	2024-06-07T12:43:12.805Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcfm6222	bafyreifzduvnwhgwqlmic6m3gidpwmdvj7d3jqw2lygc2xtjncyquyauvm	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreih6ycrwvvvewm65opmzr2w2bgbfza4o674talhlcddpixp5mf6mv4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma4s3k22"},"createdAt":"2022-07-15T00:50:55.914Z"}	2024-06-07T12:43:12.863Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmchipk22	bafyreidxda7p6snwpxwiwpkxe6hot3hhb7utw2z6wlzdxxdqm7kdj4jwvm	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreidrqkwmhh2yxhpkbisqufrib2mysgrztuof6s2ur6p7362n5ozk4q","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkma7h2c22"},"createdAt":"2022-07-15T00:50:58.914Z"}	2024-06-07T12:43:12.925Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcm27s22	bafyreiggccdefhr4abfliletitdnhlrznz2abpfrcd2mufofa44k7u2e7u	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiapglbozxgvrngr3i56brbaukc5udsdbwsmmp7axguqscbtavuz6m","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmagjmc22"},"createdAt":"2022-07-15T00:51:06.914Z"}	2024-06-07T12:43:13.071Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcnk3222	bafyreiejzhawlvggqqhqe2wkinlgjzx5zeqmvumhj5mfbcf67wy74ylk2a	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreihjk3euvxnwb34irk5rszmtai57cv5zayb6tdffswiljtylv6xu6y","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmaig5s22"},"createdAt":"2022-07-15T00:51:09.914Z"}	2024-06-07T12:43:13.120Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmcqvik22	bafyreibzdjrsmepzmiyaqmsszv3pyyddpy5nnuvujoyieyykwpvsfi2ysa	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreigzm756fmbrj22rhawr7cojojnc7g3bu32rzjw6armvhpfjvvkgz4","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmamvpk22"},"createdAt":"2022-07-15T00:51:15.914Z"}	2024-06-07T12:43:13.238Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmcsuxs22	bafyreigkub5eq2m232en4m7w5s55lmpnvlrmdqwq23w44u5ukvcgmemf3m	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreihth3a7rf7n34zk5dfqnxbaijjey52lznc6sr6xwu7tap7lu65az4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmapbv222"},"createdAt":"2022-07-15T00:51:18.914Z"}	2024-06-07T12:43:13.298Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbptus22	bafyreibqpnqgyfpogjtrp2btxi6nk66uhx2eccjxj7sj2ynwai5kk4ujca	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreigjauenhx5xcfji4c6sw7ghv2nz2p2yz4alespogrf7r7l5nexazq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7czuk22"},"createdAt":"2022-07-15T00:50:15.914Z"}	2024-06-07T12:43:12.147Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbt3fc22	bafyreibqxdhqswe47yutv2dpr7fjdoip6jwaojzlmqqfn2hmejslffqfai	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiat6kavehlet5nmwsgctjpeukavhtkalikajn54efgle2mmv2opzu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7hles22"},"createdAt":"2022-07-15T00:50:21.914Z"}	2024-06-07T12:43:12.252Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbtkzc22	bafyreift365jgi7viqfc763n3gbm4e34lxxs3ce6gf3xnsqv6bx54hl4jm	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreictq5xj4uggp3kaonouugalckasgzcvihlygzrbgnkz3npv3umhyu","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7ihp222"},"createdAt":"2022-07-15T00:50:22.914Z"}	2024-06-07T12:43:12.269Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmbulak22	bafyreibme6shvmktpnvg2js5xhzspyoll7xzvkktk73mfk2kqbo5stpsia	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiarkx6bnx7jvqoqbq7aozirex5v2356rf2zztbuuwxxfnn7ibqoly","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7jpqc22"},"createdAt":"2022-07-15T00:50:24.914Z"}	2024-06-07T12:43:12.302Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbvlhs22	bafyreifdh7inlbj2o72uymphepw7fdx7lacvkdtqaougtkkrpu4gk7whle	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreibtftyjrbiemgppzwvro2sm3mqryfdya3wuuqw3q7vcfproc6z5a4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7lp7k22"},"createdAt":"2022-07-15T00:50:26.914Z"}	2024-06-07T12:43:12.341Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmbxc5s22	bafyreibn46friqbkwc7shjpvc3rorjeieg27bbeta5yr2bcpsqyavgx5cu	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreifktbxrueu6rfzzmsva4wn6cso23x4qrxcjqgrrk4f6upo4t6dd2m","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7npo222"},"createdAt":"2022-07-15T00:50:29.914Z"}	2024-06-07T12:43:12.392Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmc2ctk22	bafyreic6i6cmf5nde2y24wvosa5pc6ejg34gtrbfygc3wxlgvb6thqajl4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiduw3nbbzfjcxoa37imhi5qtdkjr2bkxgq6k4srpwpab6zpgcxlqm","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7qglc22"},"createdAt":"2022-07-15T00:50:35.914Z"}	2024-06-07T12:43:12.492Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmc3gxs22	bafyreicwviq3o5iwjb4moug7pz6tabu7l5go7omhzc7vn2bm3xy2hsgdbe	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreihxtuaj4wfbyqjyswvscr5y7m7e7ojymxltfvrcyilg7z3yu5t7bi","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7qz5222"},"createdAt":"2022-07-15T00:50:37.914Z"}	2024-06-07T12:43:12.531Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmc4n2k22	bafyreia52blveq3vlhgiezg45oodf63dfkrnyb7gepiesg7iacu3x7q5xy	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreifl3toeqtvxgbdmp6ov6mcxxivj2entj66xn4x4kfvpp42m7gqr5q","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7rkpk22"},"createdAt":"2022-07-15T00:50:39.914Z"}	2024-06-07T12:43:12.567Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmc6ass22	bafyreib7f375jwr3f72fulckpaxpr4mlqqf4qbi3b622swtzbbkvevqokq	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreidvpfwzrp7zlftziynbgybw2d5vh36yirkrtvwollweu7o2i4l4ki","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7tm5c22"},"createdAt":"2022-07-15T00:50:42.914Z"}	2024-06-07T12:43:12.621Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmc7ex222	bafyreidtg5k6iocbzhoa5p3w4ibtk6minxq2z2ykyxfgdpreueiiuk77te	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreigb5ssh4mbqyaylhacmzhnt6oiltbpirhmqazmtbpswbfbysflgn4","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7uank22"},"createdAt":"2022-07-15T00:50:44.914Z"}	2024-06-07T12:43:12.658Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmc7vkc22	bafyreifcyxjw2dee4skfn7yanpjynxwhvgge5dlqvernklzqkfj57v7seq	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreieouj26ubtzwd43olrtigwuhdlj4e555waytjfp65lp4wahvh6eva","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7uw5222"},"createdAt":"2022-07-15T00:50:45.914Z"}	2024-06-07T12:43:12.674Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcc5ss22	bafyreihhgmrglznmlqlelmbyzyg2rhpshycvzpzcwuz734mo4iwub3i3te	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreicdlrtocb5hivmgg5vfcas2bypsrk64dehthoqhjmkvl64o6kpgqy","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7ymcc22"},"createdAt":"2022-07-15T00:50:49.914Z"}	2024-06-07T12:43:12.749Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmceyn222	bafyreia5tjs3tzp2ewp6oklqbck2w3dqet7rioc65iw6i5zdumjf2y6pqq	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreih6ycrwvvvewm65opmzr2w2bgbfza4o674talhlcddpixp5mf6mv4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma4s3k22"},"createdAt":"2022-07-15T00:50:54.914Z"}	2024-06-07T12:43:12.843Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmceh2k22	bafyreigdubfzfex653l4at2a6akexq5wvevbsf3zoec5cy3sd6c6mnfp3u	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreicgt73gbvybblwvgog63c73uoyvzkiwpflu2zi2dbywpnafz3r7mi","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkma46kk22"},"createdAt":"2022-07-15T00:50:53.914Z"}	2024-06-07T12:43:12.824Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmciqqs22	bafyreiasc3psbegk4vyhqe3hhu666g7idf6nwbcjcd7pecpc7ksp5qngym	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreifwkhtulxci2yl7bbiq5u4gs2d34ldi5o73svdvakfknp4g73ula4","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmab2sk22"},"createdAt":"2022-07-15T00:51:00.914Z"}	2024-06-07T12:43:12.965Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmcky2222	bafyreievivw2ofagwdezktauh4yhktwk4n3edlw4iw46i2i2b5imww4nia	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreihkzh7ny5yrxqemvybg3i7777fj7mfnde6xeyrt4wmxjs5rljgoge","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmaeaek22"},"createdAt":"2022-07-15T00:51:04.914Z"}	2024-06-07T12:43:13.036Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmco2oc22	bafyreihmh54k737wxexqbx54b7ayagnbltl46zv5t4z762kn6y4mrp3lyi	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreihjk3euvxnwb34irk5rszmtai57cv5zayb6tdffswiljtylv6xu6y","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmaig5s22"},"createdAt":"2022-07-15T00:51:10.914Z"}	2024-06-07T12:43:13.138Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbwrkk22	bafyreidqjad7dl664tizb6ywszf4ic6p56tp3j2yyynboau6dzng7envf4	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreid5ptmaadcgwqbehrtblhngprsk6dg2jwmc2j3zosfq7rdn57ztcy","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7mz7c22"},"createdAt":"2022-07-15T00:50:28.914Z"}	2024-06-07T12:43:12.374Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmbytxk22	bafyreiexxhkswyhqohiwjwaubcqrbbyoqlmwfpo3n2dc6ogvt3cqxlhheu	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreibjpq4ipgtmol5ckai6544ipyqmvevvjakzc4x46ac3jhfyrm7gfy","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm7of5k22"},"createdAt":"2022-07-15T00:50:32.914Z"}	2024-06-07T12:43:12.442Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmc43i222	bafyreidknw2bsnalk37yjux7t3jk6xmlji23x3m2muzkodl5pkpcsdwqjq	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreihxtuaj4wfbyqjyswvscr5y7m7e7ojymxltfvrcyilg7z3yu5t7bi","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm7qz5222"},"createdAt":"2022-07-15T00:50:38.914Z"}	2024-06-07T12:43:12.550Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmc6uds22	bafyreiciixvr6gqhjit52roy6vutzmjhklhngq26degsj4fs62be7euhvy	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreigb5ssh4mbqyaylhacmzhnt6oiltbpirhmqazmtbpswbfbysflgn4","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7uank22"},"createdAt":"2022-07-15T00:50:43.914Z"}	2024-06-07T12:43:12.640Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcbhe222	bafyreihim7d3yj4rcddzmnnb2e24hobzjnnzmm5dbnaxnoivxkwbpep4fq	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreihgh57cwdh3kywwadabvhnfpfrsvhmuugl5otz4xfsgsja7uhv2qm","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm7wtns22"},"createdAt":"2022-07-15T00:50:48.914Z"}	2024-06-07T12:43:12.726Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmcg7p222	bafyreifugmuoj4jabvu7ytmsii56znzg75ldyr7j6e4cdslarysugtvz7e	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreidtr62xflznx7wov2vsnlzhrosvckdvf4wxcxelae6psf45js2g7m","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkma5z5k22"},"createdAt":"2022-07-15T00:50:56.914Z"}	2024-06-07T12:43:12.881Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcjcdc22	bafyreiekh76fl7e4oaowdz7ogeszyy5d2f5lmc45bji6bcwimjdrgkirau	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiahz6chrakkw7en4ceothts6uyxlualmbsgaaaruneiouc4t4uqa4","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmac3z222"},"createdAt":"2022-07-15T00:51:01.914Z"}	2024-06-07T12:43:12.983Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmckfic22	bafyreicpm3fs6yfggfoqbqwhjuomzxqgff3pe3zjewfsaz555rig5mibwm	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiccumm4iihqjafzdjj4lhtzwusrwnuefibe4nm3ja337y7zwoqmse","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmadluc22"},"createdAt":"2022-07-15T00:51:03.914Z"}	2024-06-07T12:43:13.019Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmclinc22	bafyreigz7u6qagvocklhh7rlolj65yv3qzhluzxv2lliqk35fhyoj6joma	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreia25f2teavzep54pf5lpmj2c5cstertmc6uzsit6vt72k7bqlb4cm","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmaexsk22"},"createdAt":"2022-07-15T00:51:05.914Z"}	2024-06-07T12:43:13.053Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmcolbk22	bafyreihaab5tdspmlbelt2itx4m4hzuqvw4mx22i66fx54b2e4qbvvlc2e	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreibcdzdfzu6gp6maiw2aopnyop6njhp4z7s4gtdy4paifyngjcfnze","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmajvz222"},"createdAt":"2022-07-15T00:51:11.914Z"}	2024-06-07T12:43:13.157Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmcpogk22	bafyreibxtyht45ujg452yxvk7pjj2kkfflg2ywceymznnvmsu6s43psmni	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiasu4pjf66p3od3o2mxzct6ivvz43tmghpanlhjnaotmk5hs4pq3y","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmalis222"},"createdAt":"2022-07-15T00:51:13.914Z"}	2024-06-07T12:43:13.192Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmcq7z222	bafyreie7hx7pjz6i32estrygavojubj7sptyrx4d2p6mkt5f534efm3doq	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreidnh6h34yqwjgg65zdxkd35jms6vggpkc3abjojoy2bjcrmbb3f6i","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmam7as22"},"createdAt":"2022-07-15T00:51:14.914Z"}	2024-06-07T12:43:13.211Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmcsdfc22	bafyreic757whyqhknlbaoxt3w5wazhhxzcrww72cegiohrtlfwk75u2fcy	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreiaagbmljfnqkwpppijmq2rc5ld25ohrvvcsyw2ilzbsvz5wqdh5l4","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkmao7pc22"},"createdAt":"2022-07-15T00:51:17.914Z"}	2024-06-07T12:43:13.278Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmcuqk222	bafyreifihrxd4xyvengrdyza22emnpwv5fcy7lzyfe5ahsb6tnvzyj4t34	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreid3xstgek64pqr2zq6bohxi4vkfqmyr7e4wjsprguho5av3oz4ec4","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmapzd222"},"createdAt":"2022-07-15T00:51:21.914Z"}	2024-06-07T12:43:13.362Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmczvlc22	bafyreihpqekop6rp4kktj2tsxalz5lm6k3qiee4syzhxh5vyigc2rmby4i	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreidysakacrh2omr5ht5zb4xw2w46m7ngjitvefjzjzkt6qo6xjowfq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.generator/alice-favs"},"createdAt":"2022-07-15T00:51:27.914Z"}	2024-06-07T12:43:13.526Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.generator/bob-redux	bafyreibwqt7zwvetxo2tbjdgcgo2gbjjppyce7by46tvagdtu2kze26i5a	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"did":"did:plc:45kv53dueypnb4atit4fugs6","$type":"app.bsky.feed.generator","createdAt":"2022-07-15T00:51:29.914Z","displayName":"Bobby boy hot new algo"}	2024-06-07T12:43:13.570Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmd3t4222	bafyreihvhntyj52zza4vxgzqooioxxuzhnxiqyxsijqk4lxgjc6ftoeuue	did:plc:zluht54hsscg6octtayzd3ft	{"text":"bobs feed is neat too","$type":"app.bsky.feed.post","embed":{"$type":"app.bsky.embed.record","record":{"cid":"bafyreibwqt7zwvetxo2tbjdgcgo2gbjjppyce7by46tvagdtu2kze26i5a","uri":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.generator/bob-redux"}},"createdAt":"2022-07-15T00:51:30.914Z"}	2024-06-07T12:43:13.589Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.graph.list/3kudkmda6qs22	bafyreibox4vqiy3aqwc45buq67o63dmwpxq65uxifve5hy7mvey7tevdge	did:plc:zluht54hsscg6octtayzd3ft	{"name":"Flower Lovers","$type":"app.bsky.graph.list","purpose":"app.bsky.graph.defs#curatelist","createdAt":"2024-06-07T12:43:13.718Z","description":"A list of posts about flowers"}	2024-06-07T12:43:13.732Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcu32k22	bafyreigage754fwqjpknehxb25gmqrs6h7detvpyqvpayo22o5bvsngswm	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreid3xstgek64pqr2zq6bohxi4vkfqmyr7e4wjsprguho5av3oz4ec4","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmapzd222"},"createdAt":"2022-07-15T00:51:20.914Z"}	2024-06-07T12:43:13.338Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkmcyojc22	bafyreibp35vdsghs6j6yn6fcmr52tc4qzlab3uklmeev2o5lu5mhvjo5tu	did:plc:zluht54hsscg6octtayzd3ft	{"text":"check out my algorithm!","$type":"app.bsky.feed.post","embed":{"$type":"app.bsky.embed.record","record":{"cid":"bafyreidysakacrh2omr5ht5zb4xw2w46m7ngjitvefjzjzkt6qo6xjowfq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.generator/alice-favs"}},"createdAt":"2022-07-15T00:51:25.914Z"}	2024-06-07T12:43:13.488Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.graph.list/3kudkmdaz4k22	bafyreidy2za7t56ljmcknvq2xh5bgrylg64mnkegcrck663i25hu6qyniq	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"name":"Label Haters","$type":"app.bsky.graph.list","purpose":"app.bsky.graph.defs#modlist","createdAt":"2024-06-07T12:43:13.742Z","description":"A list of people who hate labels"}	2024-06-07T12:43:13.781Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.graph.listitem/3kudkmdczl222	bafyreieuieeyqn7ukyou4ofrhhqc7ywljfzv7slhfqonfmphkyf7q5hyui	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"list":"at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.graph.list/3kudkmdaz4k22","$type":"app.bsky.graph.listitem","subject":"did:plc:zluht54hsscg6octtayzd3ft","createdAt":"2024-06-07T12:43:13.809Z"}	2024-06-07T12:43:13.825Z	\N
at://did:plc:vb63kualusarrqqejvolrrv7/app.bsky.labeler.service/self	bafyreiao2my2jhxscjw5ru5ymehfqnyuu64ow5tyzu5thcp4bgfjjvvoam	did:plc:vb63kualusarrqqejvolrrv7	{"$type":"app.bsky.labeler.service","policies":{"labelValues":["!hide","porn","rude","spam","spider","misinfo","cool","curate"],"labelValueDefinitions":[{"blurs":"content","locales":[{"lang":"en","name":"Rude","description":"Just such a jerk, you wouldnt believe it."}],"severity":"alert","adultOnly":true,"identifier":"rude","defaultSetting":"warn"},{"blurs":"content","locales":[{"lang":"en","name":"Spam","description":"Low quality posts that dont add to the conversation."}],"severity":"inform","identifier":"spam","defaultSetting":"hide"},{"blurs":"media","locales":[{"lang":"en","name":"Spider!","description":"Oh no its a spider."}],"severity":"alert","identifier":"spider","defaultSetting":"warn"},{"blurs":"none","locales":[{"lang":"en","name":"Cool","description":"The coolest peeps in the atmosphere."}],"severity":"inform","identifier":"cool","defaultSetting":"warn"},{"blurs":"none","locales":[{"lang":"en","name":"Curation filter","description":"We just dont want to see it as much."}],"severity":"none","identifier":"curate","defaultSetting":"warn"}]},"createdAt":"2022-07-15T00:51:31.914Z"}	2024-06-07T12:43:13.708Z	\N
at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.like/3kudkmcvixc22	bafyreicnb2dwv2ks3hxqen6e4oa3sldre7ajeikdzzzf7t7zjeadkukhla	did:plc:5ssevsxo3qyovxpgkg3n2tfs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreicoh73xyye3txq6ooqie3h5jv62zyt4mu362kvszxkxmczef6xu5u","uri":"at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkmaqlus22"},"createdAt":"2022-07-15T00:51:22.914Z"}	2024-06-07T12:43:13.387Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.generator/alice-favs	bafyreidysakacrh2omr5ht5zb4xw2w46m7ngjitvefjzjzkt6qo6xjowfq	did:plc:zluht54hsscg6octtayzd3ft	{"did":"did:plc:42bwvozd4pfiem3axjy2xmkd","$type":"app.bsky.feed.generator","avatar":{"$type":"blob","ref":{"$link":"bafkreihem6nzbu462kcx5cqnrkonpq75fe5dlbhgnzcmuvvhqk7s5vcq3u"},"mimeType":"image/png","size":873},"createdAt":"2022-07-15T00:51:24.914Z","description":"all my fav stuff","displayName":"alices feed"}	2024-06-07T12:43:13.470Z	\N
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.like/3kudkmd2g6k22	bafyreifjcbyw2ygsq7v6ba2kgrgzkc4725lrytrbupd6p7ocfulxj3yetq	did:plc:awpz77o4dyluwpa2j2p2oqgs	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreidysakacrh2omr5ht5zb4xw2w46m7ngjitvefjzjzkt6qo6xjowfq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.generator/alice-favs"},"createdAt":"2022-07-15T00:51:28.914Z"}	2024-06-07T12:43:13.543Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.like/3kudkmczc2c22	bafyreidzh34ranysjm5odt5fhihivmhoxvmwpk3euoad4k6mzpaqhwvpie	did:plc:zluht54hsscg6octtayzd3ft	{"$type":"app.bsky.feed.like","subject":{"cid":"bafyreidysakacrh2omr5ht5zb4xw2w46m7ngjitvefjzjzkt6qo6xjowfq","uri":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.generator/alice-favs"},"createdAt":"2022-07-15T00:51:26.914Z"}	2024-06-07T12:43:13.507Z	\N
at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.graph.listitem/3kudkmdcgzc22	bafyreifx6cbttppistnsvq6ma3754sfwqygpxb3ctgp7nzvymytuwyq5qi	did:plc:zluht54hsscg6octtayzd3ft	{"list":"at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.graph.list/3kudkmda6qs22","$type":"app.bsky.graph.listitem","subject":"did:plc:5ssevsxo3qyovxpgkg3n2tfs","createdAt":"2024-06-07T12:43:13.789Z"}	2024-06-07T12:43:13.807Z	\N
\.


--
-- Data for Name: repost; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.repost (uri, cid, creator, subject, "subjectCid", "createdAt", "indexedAt") FROM stdin;
at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.repost/3kudkm6e6ks22	bafyreihkqndhv2u3jpzos2uiugmuylwfe33x6zmqnq4x47y2hf7d4cmuoe	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm5zpm222	bafyreibl6nrxujzusdkawwdxoegdgbysqt3wu7xrpimtyeqij4ldrdpvt4	2022-07-15T00:47:34.914Z	2024-06-07T12:43:08.619Z
\.


--
-- Data for Name: subscription; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.subscription (service, method, state) FROM stdin;
\.


--
-- Data for Name: suggested_feed; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.suggested_feed (uri, "order") FROM stdin;
\.


--
-- Data for Name: suggested_follow; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.suggested_follow (did, "order") FROM stdin;
\.


--
-- Data for Name: tagged_suggestion; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.tagged_suggestion (tag, subject, "subjectType") FROM stdin;
\.


--
-- Data for Name: thread_gate; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.thread_gate (uri, cid, creator, "postUri", "createdAt", "indexedAt") FROM stdin;
\.


--
-- Data for Name: view_param; Type: TABLE DATA; Schema: bsky; Owner: pg
--

COPY bsky.view_param (name, value) FROM stdin;
whats_hot_like_threshold	2
whats_hot_interval	1day
\.


--
-- Data for Name: blob_push_event; Type: TABLE DATA; Schema: ozone_db; Owner: pg
--

COPY ozone_db.blob_push_event (id, "eventType", "subjectDid", "subjectBlobCid", "subjectUri", "takedownRef", "confirmedAt", "lastAttempted", attempts) FROM stdin;
\.


--
-- Data for Name: communication_template; Type: TABLE DATA; Schema: ozone_db; Owner: pg
--

COPY ozone_db.communication_template (id, name, "contentMarkdown", subject, disabled, "createdAt", "updatedAt", "lastUpdatedBy") FROM stdin;
\.


--
-- Data for Name: kysely_migration; Type: TABLE DATA; Schema: ozone_db; Owner: pg
--

COPY ozone_db.kysely_migration (name, "timestamp") FROM stdin;
_20231219T205730722Z	2024-06-07T12:43:06.166Z
_20240116T085607200Z	2024-06-07T12:43:06.177Z
_20240201T051104136Z	2024-06-07T12:43:06.179Z
_20240208T213404429Z	2024-06-07T12:43:06.181Z
_20240228T003647759Z	2024-06-07T12:43:06.193Z
_20240408T192432676Z	2024-06-07T12:43:06.194Z
_20240506T225055595Z	2024-06-07T12:43:06.200Z
\.


--
-- Data for Name: kysely_migration_lock; Type: TABLE DATA; Schema: ozone_db; Owner: pg
--

COPY ozone_db.kysely_migration_lock (id, is_locked) FROM stdin;
migration_lock	0
\.


--
-- Data for Name: label; Type: TABLE DATA; Schema: ozone_db; Owner: pg
--

COPY ozone_db.label (id, src, uri, cid, val, neg, cts, exp, sig, "signingKeyId") FROM stdin;
\.


--
-- Data for Name: moderation_event; Type: TABLE DATA; Schema: ozone_db; Owner: pg
--

COPY ozone_db.moderation_event (id, action, "subjectType", "subjectDid", "subjectUri", "subjectCid", comment, meta, "createdAt", "createdBy", "reversedAt", "reversedBy", "durationInHours", "expiresAt", "reversedReason", "createLabelVals", "negateLabelVals", "legacyRefId", "subjectBlobCids", "addedTags", "removedTags", "subjectMessageId") FROM stdin;
1	tools.ozone.moderation.defs#modEventReport	com.atproto.admin.defs#repoRef	did:plc:zluht54hsscg6octtayzd3ft	\N	\N	Didn't look right to me	{"reportType": "com.atproto.moderation.defs#reasonSpam"}	2024-06-07T12:43:08.027Z	did:plc:5ssevsxo3qyovxpgkg3n2tfs	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
2	tools.ozone.moderation.defs#modEventTag	com.atproto.admin.defs#repoRef	did:plc:zluht54hsscg6octtayzd3ft	\N	\N	\N	{}	2024-06-07T12:43:08.083Z	did:plc:bvvapistf6rfov6ptfsomeai	\N	\N	\N	\N	\N	\N	\N	\N	\N	["lang:und"]	[]	\N
3	tools.ozone.moderation.defs#modEventReport	com.atproto.repo.strongRef	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	Didn't look right to me	{"reportType": "com.atproto.moderation.defs#reasonOther"}	2024-06-07T12:43:08.239Z	did:plc:5ssevsxo3qyovxpgkg3n2tfs	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	\N	\N
4	tools.ozone.moderation.defs#modEventTag	com.atproto.repo.strongRef	did:plc:5ssevsxo3qyovxpgkg3n2tfs	at://did:plc:5ssevsxo3qyovxpgkg3n2tfs/app.bsky.feed.post/3kudkm5xvyc22	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	\N	{}	2024-06-07T12:43:08.255Z	did:plc:bvvapistf6rfov6ptfsomeai	\N	\N	\N	\N	\N	\N	\N	\N	[]	["lang:und"]	[]	\N
5	tools.ozone.moderation.defs#modEventReport	com.atproto.repo.strongRef	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22	bafyreicwid24ntku3kmqruypwpgsdkpanhg2emvdvbkuvn3fmppxzlhdqa	Didn't look right to me	{"reportType": "com.atproto.moderation.defs#reasonSpam"}	2024-06-07T12:43:08.305Z	did:plc:5ssevsxo3qyovxpgkg3n2tfs	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	\N	\N
6	tools.ozone.moderation.defs#modEventTag	com.atproto.repo.strongRef	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm626as22	bafyreicwid24ntku3kmqruypwpgsdkpanhg2emvdvbkuvn3fmppxzlhdqa	\N	{}	2024-06-07T12:43:08.316Z	did:plc:bvvapistf6rfov6ptfsomeai	\N	\N	\N	\N	\N	\N	\N	\N	[]	["lang:und"]	[]	\N
7	tools.ozone.moderation.defs#modEventReport	com.atproto.repo.strongRef	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22	bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm	Didn't look right to me	{"reportType": "com.atproto.moderation.defs#reasonOther"}	2024-06-07T12:43:08.475Z	did:plc:5ssevsxo3qyovxpgkg3n2tfs	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	\N	\N
8	tools.ozone.moderation.defs#modEventTag	com.atproto.repo.strongRef	did:plc:awpz77o4dyluwpa2j2p2oqgs	at://did:plc:awpz77o4dyluwpa2j2p2oqgs/app.bsky.feed.post/3kudkm66zjk22	bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm	\N	{}	2024-06-07T12:43:08.489Z	did:plc:bvvapistf6rfov6ptfsomeai	\N	\N	\N	\N	\N	\N	\N	\N	[]	["lang:und"]	[]	\N
9	tools.ozone.moderation.defs#modEventReport	com.atproto.repo.strongRef	did:plc:zluht54hsscg6octtayzd3ft	at://did:plc:zluht54hsscg6octtayzd3ft/app.bsky.feed.post/3kudkm6er4k22	bafyreifed7rbzncumo543gdaydnaprdl2aokx725gk6cfruqimwngkfw2e	Didn't look right to me	{"reportType": "com.atproto.moderation.defs#reasonOther"}	2024-06-07T12:43:08.654Z	did:plc:5ssevsxo3qyovxpgkg3n2tfs	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	\N	\N
\.


--
-- Data for Name: moderation_subject_status; Type: TABLE DATA; Schema: ozone_db; Owner: pg
--

COPY ozone_db.moderation_subject_status (id, did, "recordPath", "blobCids", "recordCid", "reviewState", comment, "muteUntil", "lastReviewedAt", "lastReviewedBy", "lastReportedAt", "lastAppealedAt", takendown, "suspendUntil", appealed, "createdAt", "updatedAt", tags, "muteReportingUntil") FROM stdin;
1	did:plc:zluht54hsscg6octtayzd3ft		\N	\N	tools.ozone.moderation.defs#reviewOpen	\N	\N	\N	\N	2024-06-07T12:43:08.027Z	\N	f	\N	\N	2024-06-07T12:43:08.034Z	2024-06-07T12:43:08.085Z	["lang:und"]	\N
3	did:plc:5ssevsxo3qyovxpgkg3n2tfs	app.bsky.feed.post/3kudkm5xvyc22	\N	bafyreieo6yorgy6kyk4rptc6akozpkp7du7k5zfn46grtm6hfedxl7jbd4	tools.ozone.moderation.defs#reviewOpen	\N	\N	\N	\N	2024-06-07T12:43:08.239Z	\N	f	\N	\N	2024-06-07T12:43:08.243Z	2024-06-07T12:43:08.257Z	["lang:und"]	\N
5	did:plc:zluht54hsscg6octtayzd3ft	app.bsky.feed.post/3kudkm626as22	\N	bafyreicwid24ntku3kmqruypwpgsdkpanhg2emvdvbkuvn3fmppxzlhdqa	tools.ozone.moderation.defs#reviewOpen	\N	\N	\N	\N	2024-06-07T12:43:08.305Z	\N	f	\N	\N	2024-06-07T12:43:08.308Z	2024-06-07T12:43:08.318Z	["lang:und"]	\N
7	did:plc:awpz77o4dyluwpa2j2p2oqgs	app.bsky.feed.post/3kudkm66zjk22	\N	bafyreicdm62h7kyig4xr3ch7hlqzictdryjmaq52dr2garddp4yjilmefm	tools.ozone.moderation.defs#reviewOpen	\N	\N	\N	\N	2024-06-07T12:43:08.475Z	\N	f	\N	\N	2024-06-07T12:43:08.479Z	2024-06-07T12:43:08.491Z	["lang:und"]	\N
9	did:plc:zluht54hsscg6octtayzd3ft	app.bsky.feed.post/3kudkm6er4k22	\N	bafyreifed7rbzncumo543gdaydnaprdl2aokx725gk6cfruqimwngkfw2e	tools.ozone.moderation.defs#reviewOpen	\N	\N	\N	\N	2024-06-07T12:43:08.654Z	\N	f	\N	\N	2024-06-07T12:43:08.657Z	2024-06-07T12:43:08.657Z	\N	\N
\.


--
-- Data for Name: record_push_event; Type: TABLE DATA; Schema: ozone_db; Owner: pg
--

COPY ozone_db.record_push_event (id, "eventType", "subjectDid", "subjectUri", "subjectCid", "takedownRef", "confirmedAt", "lastAttempted", attempts) FROM stdin;
\.


--
-- Data for Name: repo_push_event; Type: TABLE DATA; Schema: ozone_db; Owner: pg
--

COPY ozone_db.repo_push_event (id, "eventType", "subjectDid", "takedownRef", "confirmedAt", "lastAttempted", attempts) FROM stdin;
\.


--
-- Data for Name: signing_key; Type: TABLE DATA; Schema: ozone_db; Owner: pg
--

COPY ozone_db.signing_key (id, key) FROM stdin;
1	did:key:zQ3shpngBHdHKoS2HoZSmAg7rR2LjFBvVdseN2ZXH5V5UG1nq
\.


--
-- Name: moderation_action_id_seq; Type: SEQUENCE SET; Schema: bsky; Owner: pg
--

SELECT pg_catalog.setval('bsky.moderation_action_id_seq', 1, false);


--
-- Name: moderation_event_id_seq; Type: SEQUENCE SET; Schema: bsky; Owner: pg
--

SELECT pg_catalog.setval('bsky.moderation_event_id_seq', 1, false);


--
-- Name: moderation_report_id_seq; Type: SEQUENCE SET; Schema: bsky; Owner: pg
--

SELECT pg_catalog.setval('bsky.moderation_report_id_seq', 1, false);


--
-- Name: moderation_subject_status_id_seq; Type: SEQUENCE SET; Schema: bsky; Owner: pg
--

SELECT pg_catalog.setval('bsky.moderation_subject_status_id_seq', 1, false);


--
-- Name: notification_id_seq; Type: SEQUENCE SET; Schema: bsky; Owner: pg
--

SELECT pg_catalog.setval('bsky.notification_id_seq', 198, true);


--
-- Name: blob_push_event_id_seq; Type: SEQUENCE SET; Schema: ozone_db; Owner: pg
--

SELECT pg_catalog.setval('ozone_db.blob_push_event_id_seq', 1, false);


--
-- Name: communication_template_id_seq; Type: SEQUENCE SET; Schema: ozone_db; Owner: pg
--

SELECT pg_catalog.setval('ozone_db.communication_template_id_seq', 1, false);


--
-- Name: label_id_seq; Type: SEQUENCE SET; Schema: ozone_db; Owner: pg
--

SELECT pg_catalog.setval('ozone_db.label_id_seq', 1, false);


--
-- Name: moderation_event_id_seq; Type: SEQUENCE SET; Schema: ozone_db; Owner: pg
--

SELECT pg_catalog.setval('ozone_db.moderation_event_id_seq', 9, true);


--
-- Name: moderation_subject_status_id_seq; Type: SEQUENCE SET; Schema: ozone_db; Owner: pg
--

SELECT pg_catalog.setval('ozone_db.moderation_subject_status_id_seq', 9, true);


--
-- Name: record_push_event_id_seq; Type: SEQUENCE SET; Schema: ozone_db; Owner: pg
--

SELECT pg_catalog.setval('ozone_db.record_push_event_id_seq', 1, false);


--
-- Name: repo_push_event_id_seq; Type: SEQUENCE SET; Schema: ozone_db; Owner: pg
--

SELECT pg_catalog.setval('ozone_db.repo_push_event_id_seq', 1, false);


--
-- Name: signing_key_id_seq; Type: SEQUENCE SET; Schema: ozone_db; Owner: pg
--

SELECT pg_catalog.setval('ozone_db.signing_key_id_seq', 1, true);


--
-- Name: actor_block actor_block_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.actor_block
    ADD CONSTRAINT actor_block_pkey PRIMARY KEY (uri);


--
-- Name: actor_block actor_block_unique_subject; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.actor_block
    ADD CONSTRAINT actor_block_unique_subject UNIQUE (creator, "subjectDid");


--
-- Name: actor actor_handle_key; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.actor
    ADD CONSTRAINT actor_handle_key UNIQUE (handle);


--
-- Name: actor actor_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.actor
    ADD CONSTRAINT actor_pkey PRIMARY KEY (did);


--
-- Name: actor_state actor_state_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.actor_state
    ADD CONSTRAINT actor_state_pkey PRIMARY KEY (did);


--
-- Name: actor_sync actor_sync_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.actor_sync
    ADD CONSTRAINT actor_sync_pkey PRIMARY KEY (did);


--
-- Name: blob_takedown blob_takedown_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.blob_takedown
    ADD CONSTRAINT blob_takedown_pkey PRIMARY KEY (did, cid);


--
-- Name: did_cache did_cache_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.did_cache
    ADD CONSTRAINT did_cache_pkey PRIMARY KEY (did);


--
-- Name: duplicate_record duplicate_record_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.duplicate_record
    ADD CONSTRAINT duplicate_record_pkey PRIMARY KEY (uri);


--
-- Name: feed_generator feed_generator_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.feed_generator
    ADD CONSTRAINT feed_generator_pkey PRIMARY KEY (uri);


--
-- Name: feed_item feed_item_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.feed_item
    ADD CONSTRAINT feed_item_pkey PRIMARY KEY (uri);


--
-- Name: follow follow_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.follow
    ADD CONSTRAINT follow_pkey PRIMARY KEY (uri);


--
-- Name: follow follow_unique_subject; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.follow
    ADD CONSTRAINT follow_unique_subject UNIQUE (creator, "subjectDid");


--
-- Name: kysely_migration_lock kysely_migration_lock_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.kysely_migration_lock
    ADD CONSTRAINT kysely_migration_lock_pkey PRIMARY KEY (id);


--
-- Name: kysely_migration kysely_migration_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.kysely_migration
    ADD CONSTRAINT kysely_migration_pkey PRIMARY KEY (name);


--
-- Name: label label_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.label
    ADD CONSTRAINT label_pkey PRIMARY KEY (src, uri, cid, val);


--
-- Name: labeler labeler_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.labeler
    ADD CONSTRAINT labeler_pkey PRIMARY KEY (uri);


--
-- Name: like like_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky."like"
    ADD CONSTRAINT like_pkey PRIMARY KEY (uri);


--
-- Name: like like_unique_subject; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky."like"
    ADD CONSTRAINT like_unique_subject UNIQUE (subject, creator);


--
-- Name: list_block list_block_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.list_block
    ADD CONSTRAINT list_block_pkey PRIMARY KEY (uri);


--
-- Name: list_block list_block_unique_subject; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.list_block
    ADD CONSTRAINT list_block_unique_subject UNIQUE (creator, "subjectUri");


--
-- Name: list_item list_item_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.list_item
    ADD CONSTRAINT list_item_pkey PRIMARY KEY (uri);


--
-- Name: list_item list_item_unique_subject_in_list; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.list_item
    ADD CONSTRAINT list_item_unique_subject_in_list UNIQUE ("listUri", "subjectDid");


--
-- Name: list_mute list_mute_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.list_mute
    ADD CONSTRAINT list_mute_pkey PRIMARY KEY ("mutedByDid", "listUri");


--
-- Name: list list_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.list
    ADD CONSTRAINT list_pkey PRIMARY KEY (uri);


--
-- Name: moderation_action moderation_action_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.moderation_action
    ADD CONSTRAINT moderation_action_pkey PRIMARY KEY (id);


--
-- Name: moderation_action_subject_blob moderation_action_subject_blob_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.moderation_action_subject_blob
    ADD CONSTRAINT moderation_action_subject_blob_pkey PRIMARY KEY ("actionId", cid);


--
-- Name: moderation_event moderation_event_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.moderation_event
    ADD CONSTRAINT moderation_event_pkey PRIMARY KEY (id);


--
-- Name: moderation_report moderation_report_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.moderation_report
    ADD CONSTRAINT moderation_report_pkey PRIMARY KEY (id);


--
-- Name: moderation_report_resolution moderation_report_resolution_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.moderation_report_resolution
    ADD CONSTRAINT moderation_report_resolution_pkey PRIMARY KEY ("reportId", "actionId");


--
-- Name: moderation_subject_status moderation_status_unique_idx; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.moderation_subject_status
    ADD CONSTRAINT moderation_status_unique_idx UNIQUE (did, "recordPath");


--
-- Name: moderation_subject_status moderation_subject_status_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.moderation_subject_status
    ADD CONSTRAINT moderation_subject_status_pkey PRIMARY KEY (id);


--
-- Name: mute mute_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.mute
    ADD CONSTRAINT mute_pkey PRIMARY KEY ("mutedByDid", "subjectDid");


--
-- Name: notification notification_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.notification
    ADD CONSTRAINT notification_pkey PRIMARY KEY (id);


--
-- Name: notification_push_token notification_push_token_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.notification_push_token
    ADD CONSTRAINT notification_push_token_pkey PRIMARY KEY (did, token);


--
-- Name: post_agg post_agg_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.post_agg
    ADD CONSTRAINT post_agg_pkey PRIMARY KEY (uri);


--
-- Name: post_embed_external post_embed_external_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.post_embed_external
    ADD CONSTRAINT post_embed_external_pkey PRIMARY KEY ("postUri");


--
-- Name: post_embed_image post_embed_image_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.post_embed_image
    ADD CONSTRAINT post_embed_image_pkey PRIMARY KEY ("postUri", "position");


--
-- Name: post_embed_record post_embed_record_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.post_embed_record
    ADD CONSTRAINT post_embed_record_pkey PRIMARY KEY ("postUri", "embedUri");


--
-- Name: post post_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.post
    ADD CONSTRAINT post_pkey PRIMARY KEY (uri);


--
-- Name: profile_agg profile_agg_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.profile_agg
    ADD CONSTRAINT profile_agg_pkey PRIMARY KEY (did);


--
-- Name: profile profile_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.profile
    ADD CONSTRAINT profile_pkey PRIMARY KEY (uri);


--
-- Name: record record_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.record
    ADD CONSTRAINT record_pkey PRIMARY KEY (uri);


--
-- Name: repost repost_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.repost
    ADD CONSTRAINT repost_pkey PRIMARY KEY (uri);


--
-- Name: repost repost_unique_subject; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.repost
    ADD CONSTRAINT repost_unique_subject UNIQUE (creator, subject);


--
-- Name: subscription subscription_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.subscription
    ADD CONSTRAINT subscription_pkey PRIMARY KEY (service, method);


--
-- Name: suggested_feed suggested_feed_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.suggested_feed
    ADD CONSTRAINT suggested_feed_pkey PRIMARY KEY (uri);


--
-- Name: suggested_follow suggested_follow_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.suggested_follow
    ADD CONSTRAINT suggested_follow_pkey PRIMARY KEY (did);


--
-- Name: tagged_suggestion tagged_suggestion_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.tagged_suggestion
    ADD CONSTRAINT tagged_suggestion_pkey PRIMARY KEY (tag, subject);


--
-- Name: thread_gate thread_gate_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.thread_gate
    ADD CONSTRAINT thread_gate_pkey PRIMARY KEY (uri);


--
-- Name: thread_gate thread_gate_postUri_key; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.thread_gate
    ADD CONSTRAINT "thread_gate_postUri_key" UNIQUE ("postUri");


--
-- Name: view_param view_param_pkey; Type: CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.view_param
    ADD CONSTRAINT view_param_pkey PRIMARY KEY (name);


--
-- Name: blob_push_event blob_push_event_pkey; Type: CONSTRAINT; Schema: ozone_db; Owner: pg
--

ALTER TABLE ONLY ozone_db.blob_push_event
    ADD CONSTRAINT blob_push_event_pkey PRIMARY KEY (id);


--
-- Name: blob_push_event blob_push_event_unique_evt; Type: CONSTRAINT; Schema: ozone_db; Owner: pg
--

ALTER TABLE ONLY ozone_db.blob_push_event
    ADD CONSTRAINT blob_push_event_unique_evt UNIQUE ("subjectDid", "subjectBlobCid", "eventType");


--
-- Name: communication_template communication_template_pkey; Type: CONSTRAINT; Schema: ozone_db; Owner: pg
--

ALTER TABLE ONLY ozone_db.communication_template
    ADD CONSTRAINT communication_template_pkey PRIMARY KEY (id);


--
-- Name: communication_template communication_template_unique_name; Type: CONSTRAINT; Schema: ozone_db; Owner: pg
--

ALTER TABLE ONLY ozone_db.communication_template
    ADD CONSTRAINT communication_template_unique_name UNIQUE (name, disabled);


--
-- Name: kysely_migration_lock kysely_migration_lock_pkey; Type: CONSTRAINT; Schema: ozone_db; Owner: pg
--

ALTER TABLE ONLY ozone_db.kysely_migration_lock
    ADD CONSTRAINT kysely_migration_lock_pkey PRIMARY KEY (id);


--
-- Name: kysely_migration kysely_migration_pkey; Type: CONSTRAINT; Schema: ozone_db; Owner: pg
--

ALTER TABLE ONLY ozone_db.kysely_migration
    ADD CONSTRAINT kysely_migration_pkey PRIMARY KEY (name);


--
-- Name: label label_pkey; Type: CONSTRAINT; Schema: ozone_db; Owner: pg
--

ALTER TABLE ONLY ozone_db.label
    ADD CONSTRAINT label_pkey PRIMARY KEY (id);


--
-- Name: moderation_event moderation_event_pkey; Type: CONSTRAINT; Schema: ozone_db; Owner: pg
--

ALTER TABLE ONLY ozone_db.moderation_event
    ADD CONSTRAINT moderation_event_pkey PRIMARY KEY (id);


--
-- Name: moderation_subject_status moderation_status_unique_idx; Type: CONSTRAINT; Schema: ozone_db; Owner: pg
--

ALTER TABLE ONLY ozone_db.moderation_subject_status
    ADD CONSTRAINT moderation_status_unique_idx UNIQUE (did, "recordPath");


--
-- Name: moderation_subject_status moderation_subject_status_pkey; Type: CONSTRAINT; Schema: ozone_db; Owner: pg
--

ALTER TABLE ONLY ozone_db.moderation_subject_status
    ADD CONSTRAINT moderation_subject_status_pkey PRIMARY KEY (id);


--
-- Name: record_push_event record_push_event_pkey; Type: CONSTRAINT; Schema: ozone_db; Owner: pg
--

ALTER TABLE ONLY ozone_db.record_push_event
    ADD CONSTRAINT record_push_event_pkey PRIMARY KEY (id);


--
-- Name: record_push_event record_push_event_unique_evt; Type: CONSTRAINT; Schema: ozone_db; Owner: pg
--

ALTER TABLE ONLY ozone_db.record_push_event
    ADD CONSTRAINT record_push_event_unique_evt UNIQUE ("subjectUri", "eventType");


--
-- Name: repo_push_event repo_push_event_pkey; Type: CONSTRAINT; Schema: ozone_db; Owner: pg
--

ALTER TABLE ONLY ozone_db.repo_push_event
    ADD CONSTRAINT repo_push_event_pkey PRIMARY KEY (id);


--
-- Name: repo_push_event repo_push_event_unique_evt; Type: CONSTRAINT; Schema: ozone_db; Owner: pg
--

ALTER TABLE ONLY ozone_db.repo_push_event
    ADD CONSTRAINT repo_push_event_unique_evt UNIQUE ("subjectDid", "eventType");


--
-- Name: signing_key signing_key_key_key; Type: CONSTRAINT; Schema: ozone_db; Owner: pg
--

ALTER TABLE ONLY ozone_db.signing_key
    ADD CONSTRAINT signing_key_key_key UNIQUE (key);


--
-- Name: signing_key signing_key_pkey; Type: CONSTRAINT; Schema: ozone_db; Owner: pg
--

ALTER TABLE ONLY ozone_db.signing_key
    ADD CONSTRAINT signing_key_pkey PRIMARY KEY (id);


--
-- Name: actor_block_subjectdid_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX actor_block_subjectdid_idx ON bsky.actor_block USING btree ("subjectDid");


--
-- Name: actor_handle_tgrm_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX actor_handle_tgrm_idx ON bsky.actor USING gist (handle public.gist_trgm_ops);


--
-- Name: algo_whats_hot_view_cursor_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX algo_whats_hot_view_cursor_idx ON bsky.algo_whats_hot_view USING btree (score, cid);


--
-- Name: algo_whats_hot_view_uri_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE UNIQUE INDEX algo_whats_hot_view_uri_idx ON bsky.algo_whats_hot_view USING btree (uri);


--
-- Name: duplicate_record_duplicate_of_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX duplicate_record_duplicate_of_idx ON bsky.duplicate_record USING btree ("duplicateOf");


--
-- Name: feed_generator_creator_index; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX feed_generator_creator_index ON bsky.feed_generator USING btree (creator);


--
-- Name: feed_item_cursor_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX feed_item_cursor_idx ON bsky.feed_item USING btree ("sortAt", cid);


--
-- Name: feed_item_originator_cursor_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX feed_item_originator_cursor_idx ON bsky.feed_item USING btree ("originatorDid", "sortAt", cid);


--
-- Name: feed_item_post_uri_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX feed_item_post_uri_idx ON bsky.feed_item USING btree ("postUri");


--
-- Name: follow_creator_cursor_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX follow_creator_cursor_idx ON bsky.follow USING btree (creator, "sortAt", cid);


--
-- Name: follow_subject_cursor_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX follow_subject_cursor_idx ON bsky.follow USING btree ("subjectDid", "sortAt", cid);


--
-- Name: label_cts_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX label_cts_idx ON bsky.label USING btree (cts);


--
-- Name: label_uri_index; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX label_uri_index ON bsky.label USING btree (uri);


--
-- Name: labeler_order_by_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX labeler_order_by_idx ON bsky.labeler USING btree ("sortAt", cid);


--
-- Name: like_creator_cursor_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX like_creator_cursor_idx ON bsky."like" USING btree (creator, "sortAt", cid);


--
-- Name: list_creator_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX list_creator_idx ON bsky.list USING btree (creator);


--
-- Name: list_item_creator_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX list_item_creator_idx ON bsky.list_item USING btree (creator);


--
-- Name: list_item_subject_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX list_item_subject_idx ON bsky.list_item USING btree ("subjectDid");


--
-- Name: moderation_action_subject_blob_cid_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX moderation_action_subject_blob_cid_idx ON bsky.moderation_action_subject_blob USING btree (cid);


--
-- Name: moderation_report_resolution_action_id_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX moderation_report_resolution_action_id_idx ON bsky.moderation_report_resolution USING btree ("actionId");


--
-- Name: moderation_subject_status_blob_cids_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX moderation_subject_status_blob_cids_idx ON bsky.moderation_subject_status USING gin ("blobCids");


--
-- Name: notification_author_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX notification_author_idx ON bsky.notification USING btree (author);


--
-- Name: notification_did_sortat_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX notification_did_sortat_idx ON bsky.notification USING btree (did, "sortAt");


--
-- Name: notification_record_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX notification_record_idx ON bsky.notification USING btree ("recordUri");


--
-- Name: post_creator_cursor_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX post_creator_cursor_idx ON bsky.post USING btree (creator, "sortAt", cid);


--
-- Name: post_order_by_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX post_order_by_idx ON bsky.post USING btree ("sortAt", cid);


--
-- Name: post_replyparent_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX post_replyparent_idx ON bsky.post USING btree ("replyParent") INCLUDE (uri);


--
-- Name: profile_creator_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX profile_creator_idx ON bsky.profile USING btree (creator);


--
-- Name: profile_display_name_tgrm_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX profile_display_name_tgrm_idx ON bsky.profile USING gist ("displayName" public.gist_trgm_ops);


--
-- Name: record_did_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX record_did_idx ON bsky.record USING btree (did);


--
-- Name: repost_order_by_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX repost_order_by_idx ON bsky.repost USING btree ("sortAt", cid);


--
-- Name: repost_subject_idx; Type: INDEX; Schema: bsky; Owner: pg
--

CREATE INDEX repost_subject_idx ON bsky.repost USING btree (subject);


--
-- Name: blob_push_confirmation_idx; Type: INDEX; Schema: ozone_db; Owner: pg
--

CREATE INDEX blob_push_confirmation_idx ON ozone_db.blob_push_event USING btree ("confirmedAt", attempts);


--
-- Name: label_uri_index; Type: INDEX; Schema: ozone_db; Owner: pg
--

CREATE INDEX label_uri_index ON ozone_db.label USING btree (uri);


--
-- Name: moderation_event_message_id_index; Type: INDEX; Schema: ozone_db; Owner: pg
--

CREATE INDEX moderation_event_message_id_index ON ozone_db.moderation_event USING btree ("subjectMessageId");


--
-- Name: moderation_subject_status_blob_cids_idx; Type: INDEX; Schema: ozone_db; Owner: pg
--

CREATE INDEX moderation_subject_status_blob_cids_idx ON ozone_db.moderation_subject_status USING gin ("blobCids");


--
-- Name: record_push_confirmation_idx; Type: INDEX; Schema: ozone_db; Owner: pg
--

CREATE INDEX record_push_confirmation_idx ON ozone_db.record_push_event USING btree ("confirmedAt", attempts);


--
-- Name: record_push_event_did_type_idx; Type: INDEX; Schema: ozone_db; Owner: pg
--

CREATE INDEX record_push_event_did_type_idx ON ozone_db.record_push_event USING btree ("subjectDid", "eventType");


--
-- Name: repo_push_confirmation_idx; Type: INDEX; Schema: ozone_db; Owner: pg
--

CREATE INDEX repo_push_confirmation_idx ON ozone_db.repo_push_event USING btree ("confirmedAt", attempts);


--
-- Name: unique_label_idx; Type: INDEX; Schema: ozone_db; Owner: pg
--

CREATE UNIQUE INDEX unique_label_idx ON ozone_db.label USING btree (src, uri, cid, val);


--
-- Name: moderation_action_subject_blob moderation_action_subject_blob_actionId_fkey; Type: FK CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.moderation_action_subject_blob
    ADD CONSTRAINT "moderation_action_subject_blob_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES bsky.moderation_action(id);


--
-- Name: moderation_report_resolution moderation_report_resolution_actionId_fkey; Type: FK CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.moderation_report_resolution
    ADD CONSTRAINT "moderation_report_resolution_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES bsky.moderation_action(id);


--
-- Name: moderation_report_resolution moderation_report_resolution_reportId_fkey; Type: FK CONSTRAINT; Schema: bsky; Owner: pg
--

ALTER TABLE ONLY bsky.moderation_report_resolution
    ADD CONSTRAINT "moderation_report_resolution_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES bsky.moderation_report(id);


--
-- Name: algo_whats_hot_view; Type: MATERIALIZED VIEW DATA; Schema: bsky; Owner: pg
--

REFRESH MATERIALIZED VIEW bsky.algo_whats_hot_view;


--
-- PostgreSQL database dump complete
--

