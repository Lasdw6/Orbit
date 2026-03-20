import { randomUUID } from 'expo-crypto';
import * as Contacts from 'expo-contacts';
import { BRIGHT_STARS, CONSTELLATION_LINES, normalizeRA } from './starData';
import * as SQLite from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import {
  Fragment,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

const ORBIT_LOGO_SVG = `<svg width="200" height="200" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="tile" x1="10" y1="10" x2="110" y2="110" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#11121f"/>
      <stop offset="54%" stop-color="#0b0c15"/>
      <stop offset="100%" stop-color="#07080f"/>
    </linearGradient>
    <linearGradient id="planet" x1="40" y1="36" x2="74" y2="84" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#d9deef"/>
      <stop offset="100%" stop-color="#b8bfd8"/>
    </linearGradient>
    <linearGradient id="ring" x1="20" y1="77" x2="96" y2="43" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4f58c7"/>
      <stop offset="100%" stop-color="#6672ea"/>
    </linearGradient>
    <mask id="planetHole">
      <rect width="120" height="120" fill="#ffffff"/>
      <ellipse cx="60" cy="62" rx="24" ry="28" fill="#000000"/>
    </mask>
  </defs>
  <rect x="8" y="8" width="104" height="104" rx="28" fill="url(#tile)"/>
  <g fill="#c8d0ff" opacity="0.42">
    <path d="M27.8 27.2l0.8 2.1 2.1 0.8-2.1 0.8-0.8 2.1-0.8-2.1-2.1-0.8 2.1-0.8z"/>
    <path d="M91.7 23.5l0.7 1.8 1.8 0.7-1.8 0.7-0.7 1.8-0.7-1.8-1.8-0.7 1.8-0.7z"/>
    <path d="M95.8 81.1l0.8 2 2 0.8-2 0.8-0.8 2-0.8-2-2-0.8 2-0.8z"/>
    <path d="M41.6 92.2l0.6 1.6 1.6 0.6-1.6 0.6-0.6 1.6-0.6-1.6-1.6-0.6 1.6-0.6z"/>
  </g>
  <g fill="#ffffff" opacity="0.2">
    <path d="M38 21.8l0.5 1.3 1.3 0.5-1.3 0.5-0.5 1.3-0.5-1.3-1.3-0.5 1.3-0.5z"/>
    <path d="M82.9 36.8l0.45 1.15 1.15 0.45-1.15 0.45-0.45 1.15-0.45-1.15-1.15-0.45 1.15-0.45z"/>
    <path d="M28 85.8l0.5 1.3 1.3 0.5-1.3 0.5-0.5 1.3-0.5-1.3-1.3-0.5 1.3-0.5z"/>
  </g>
  <g transform="rotate(24 60 60)">
    <ellipse cx="60" cy="63" rx="33" ry="11.2" fill="none" stroke="url(#ring)" stroke-width="8" mask="url(#planetHole)"/>
  </g>
  <ellipse cx="60" cy="62" rx="24" ry="28" fill="url(#planet)"/>
  <ellipse cx="53.5" cy="49.5" rx="10" ry="7" fill="#ffffff" opacity="0.12"/>
  <g transform="rotate(24 60 60)">
    <ellipse
      cx="60"
      cy="63"
      rx="33"
      ry="11.2"
      fill="none"
      stroke="url(#ring)"
      stroke-width="8"
      stroke-linecap="round"
      stroke-dasharray="58 150"
      stroke-dashoffset="-76"
    />
  </g>
</svg>`;

const RELATIONSHIPS = ['close', 'acquaintance', 'just met'] as const;
const NOTE_TYPES = ['free', 'coffee', 'call', 'message', 'event', 'intro'] as const;
const FILTERS = ['all', 'follow up', 'close'] as const;
const TAG_COLORS = ['#6a58cc', '#4f8cff', '#1f9d72', '#c17d2f', '#b94e7a', '#6b7280'] as const;
const DEFAULT_TAG_COLOR = TAG_COLORS[0];

type Relationship = (typeof RELATIONSHIPS)[number];
type NoteType = (typeof NOTE_TYPES)[number];
type FilterType = (typeof FILTERS)[number];

type PersonRow = {
  id: string;
  name: string;
  summary: string | null;
  company: string | null;
  role: string | null;
  city: string | null;
  school: string | null;
  phone: string | null;
  met_at: string | null;
  met_date: string | null;
  relationship: Relationship | null;
  photo_uri: string | null;
  email: string | null;
  instagram: string | null;
  linkedin: string | null;
  twitter: string | null;
  website: string | null;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string;
};

type NoteRow = {
  id: string;
  person_id: string;
  type: NoteType | null;
  body: string;
  pinned: number;
  created_at: string;
  updated_at: string;
};

type TagJoinRow = {
  person_id: string;
  id: string;
  label: string;
  color: string | null;
  created_at: string;
};

type TagRow = {
  id: string;
  label: string;
  color: string | null;
  created_at: string;
};

type TagOption = {
  id: string;
  label: string;
  color: string;
};

type PersonRecord = PersonRow & {
  notes: NoteRow[];
  tags: TagJoinRow[];
};

type PersonDraft = {
  name: string;
  summary: string;
  company: string;
  role: string;
  city: string;
  school: string;
  phone: string;
  metAt: string;
  metDate: string;
  relationship: Relationship;
  email: string;
  instagram: string;
  linkedin: string;
  twitter: string;
  website: string;
  followUpDate: string;
  tags: string[];
};

type NoteDraft = {
  type: NoteType;
  body: string;
  pinned: boolean;
};

type SectionType = 'people' | 'notes' | 'tags';

const emptyPersonDraft: PersonDraft = {
  name: '',
  summary: '',
  company: '',
  role: '',
  city: '',
  school: '',
  phone: '',
  metAt: '',
  metDate: '',
  relationship: 'acquaintance',
  email: '',
  instagram: '',
  linkedin: '',
  twitter: '',
  website: '',
  followUpDate: '',
  tags: [],
};

const emptyNoteDraft: NoteDraft = {
  type: 'free',
  body: '',
  pinned: false,
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDatabase() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('orbit.db');
      await db.execAsync(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS person (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          summary TEXT,
          company TEXT,
          role TEXT,
          city TEXT,
          school TEXT,
          phone TEXT,
          met_at TEXT,
          met_date TEXT,
          relationship TEXT CHECK(relationship IN ('close','acquaintance','just met')),
          photo_uri TEXT,
          email TEXT,
          instagram TEXT,
          linkedin TEXT,
          twitter TEXT,
          website TEXT,
          follow_up_date TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS note (
          id TEXT PRIMARY KEY,
          person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
          type TEXT CHECK(type IN ('free','coffee','call','message','event','intro')),
          body TEXT NOT NULL,
          pinned INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tag (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL UNIQUE,
          color TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS person_tag (
          person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
          tag_id TEXT NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
          PRIMARY KEY (person_id, tag_id)
        );
      `);
      for (const column of ['email', 'instagram', 'linkedin', 'twitter', 'website']) {
        try {
          await db.execAsync(`ALTER TABLE person ADD COLUMN ${column} TEXT;`);
        } catch {}
      }
      try {
        await db.execAsync(`ALTER TABLE person ADD COLUMN phone TEXT;`);
      } catch {}
      try {
        await db.execAsync(`ALTER TABLE tag ADD COLUMN color TEXT;`);
      } catch {}
      await db.runAsync(
        `UPDATE tag SET color = ? WHERE color IS NULL OR trim(color) = ''`,
        DEFAULT_TAG_COLOR
      );
      return db;
    })();
  }

  return dbPromise;
}

function nowIso() {
  return new Date().toISOString();
}

function cleanValue(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function buildCells(entries: Array<[string, string | null | undefined]>) {
  return entries.filter(([, value]) => Boolean(value && value.trim())) as string[][];
}

function formatDate(value: string | null, compact = false) {
  if (!value) {
    return compact ? '' : '-';
  }

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(compact ? {} : { year: 'numeric' }),
  });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.length ? parts.map((part) => part[0]?.toUpperCase() ?? '').join('') : '??';
}

function hasFollowUp(person: PersonRow) {
  return Boolean(person.follow_up_date);
}

function normalizeTagColor(color: string | null | undefined) {
  return color && TAG_COLORS.includes(color as (typeof TAG_COLORS)[number]) ? color : DEFAULT_TAG_COLOR;
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized;
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function buildPeople(peopleRows: PersonRow[], noteRows: NoteRow[], tagRows: TagJoinRow[]) {
  const notesByPerson = new Map<string, NoteRow[]>();
  const tagsByPerson = new Map<string, TagJoinRow[]>();

  noteRows.forEach((note) => {
    notesByPerson.set(note.person_id, [...(notesByPerson.get(note.person_id) ?? []), note]);
  });
  tagRows.forEach((tag) => {
    tagsByPerson.set(tag.person_id, [...(tagsByPerson.get(tag.person_id) ?? []), tag]);
  });

  return peopleRows.map((person) => ({
    ...person,
    notes: notesByPerson.get(person.id) ?? [],
    tags: tagsByPerson.get(person.id) ?? [],
  }));
}

async function loadPeople() {
  const db = await getDatabase();
  const [peopleRows, noteRows, tagRows] = await Promise.all([
    db.getAllAsync<PersonRow>(
      `SELECT * FROM person
       ORDER BY CASE WHEN follow_up_date IS NULL THEN 1 ELSE 0 END, datetime(updated_at) DESC`
    ),
    db.getAllAsync<NoteRow>(
      `SELECT * FROM note ORDER BY pinned DESC, datetime(updated_at) DESC`
    ),
    db.getAllAsync<TagJoinRow>(
      `SELECT person_tag.person_id, tag.id, tag.label, tag.color, tag.created_at
       FROM person_tag JOIN tag ON tag.id = person_tag.tag_id
       ORDER BY tag.label ASC`
    ),
  ]);

  return buildPeople(peopleRows, noteRows, tagRows);
}

async function loadTagCatalog() {
  const db = await getDatabase();
  return db.getAllAsync<TagRow>(`SELECT id, label, color, created_at FROM tag ORDER BY label ASC`);
}

async function insertPerson(draft: PersonDraft) {
  const db = await getDatabase();
  const personId = randomUUID();
  const now = nowIso();
  const labels = Array.from(new Set(draft.tags.map((t) => t.trim()).filter(Boolean)));

  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO person (
        id, name, summary, company, role, city, school, phone, met_at, met_date,
        relationship, photo_uri, email, instagram, linkedin, twitter, website,
        follow_up_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      personId,
      draft.name.trim(),
      cleanValue(draft.summary),
      cleanValue(draft.company),
      cleanValue(draft.role),
      cleanValue(draft.city),
      cleanValue(draft.school),
      cleanValue(draft.phone),
      cleanValue(draft.metAt),
      cleanValue(draft.metDate),
      draft.relationship,
      null,
      cleanValue(draft.email),
      cleanValue(draft.instagram),
      cleanValue(draft.linkedin),
      cleanValue(draft.twitter),
      cleanValue(draft.website),
      cleanValue(draft.followUpDate),
      now,
      now
    );

    for (const label of labels) {
      const existing = await tx.getFirstAsync<{ id: string }>(
        `SELECT id FROM tag WHERE lower(label) = lower(?) LIMIT 1`,
        label
      );
      const tagId = existing?.id ?? randomUUID();

      if (!existing) {
        await tx.runAsync(
          `INSERT INTO tag (id, label, color, created_at) VALUES (?, ?, ?, ?)`,
          tagId,
          label,
          DEFAULT_TAG_COLOR,
          now
        );
      }

      await tx.runAsync(
        `INSERT OR IGNORE INTO person_tag (person_id, tag_id) VALUES (?, ?)`,
        personId,
        tagId
      );
    }
  });

  return personId;
}

async function insertNote(personId: string, draft: NoteDraft) {
  const db = await getDatabase();
  const now = nowIso();

  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO note (id, person_id, type, body, pinned, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(),
      personId,
      draft.type,
      draft.body.trim(),
      draft.pinned ? 1 : 0,
      now,
      now
    );
    await tx.runAsync(`UPDATE person SET updated_at = ? WHERE id = ?`, now, personId);
  });
}

async function syncPersonTags(tx: any, personId: string, tags: string[], now: string) {
  const labels = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));

  await tx.runAsync(`DELETE FROM person_tag WHERE person_id = ?`, personId);

  for (const label of labels) {
    const existing = (await tx.getFirstAsync(
      `SELECT id FROM tag WHERE lower(label) = lower(?) LIMIT 1`,
      label
    )) as { id: string } | null;
    const tagId = existing?.id ?? randomUUID();

    if (!existing) {
      await tx.runAsync(
        `INSERT INTO tag (id, label, color, created_at) VALUES (?, ?, ?, ?)`,
        tagId,
        label,
        DEFAULT_TAG_COLOR,
        now
      );
    }

    await tx.runAsync(
      `INSERT OR IGNORE INTO person_tag (person_id, tag_id) VALUES (?, ?)`,
      personId,
      tagId
    );
  }
}

async function updatePerson(personId: string, draft: PersonDraft) {
  const db = await getDatabase();
  const now = nowIso();

  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `UPDATE person
       SET name = ?, summary = ?, company = ?, role = ?, city = ?, school = ?, phone = ?,
           met_at = ?, met_date = ?, relationship = ?, email = ?, instagram = ?, linkedin = ?,
           twitter = ?, website = ?, follow_up_date = ?, updated_at = ?
       WHERE id = ?`,
      draft.name.trim(),
      cleanValue(draft.summary),
      cleanValue(draft.company),
      cleanValue(draft.role),
      cleanValue(draft.city),
      cleanValue(draft.school),
      cleanValue(draft.phone),
      cleanValue(draft.metAt),
      cleanValue(draft.metDate),
      draft.relationship,
      cleanValue(draft.email),
      cleanValue(draft.instagram),
      cleanValue(draft.linkedin),
      cleanValue(draft.twitter),
      cleanValue(draft.website),
      cleanValue(draft.followUpDate),
      now,
      personId
    );

    await syncPersonTags(tx, personId, draft.tags, now);
  });
}

async function deletePerson(personId: string) {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM person WHERE id = ?`, personId);
}

async function updateNote(noteId: string, personId: string, draft: NoteDraft) {
  const db = await getDatabase();
  const now = nowIso();

  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `UPDATE note
       SET type = ?, body = ?, pinned = ?, updated_at = ?
       WHERE id = ?`,
      draft.type,
      draft.body.trim(),
      draft.pinned ? 1 : 0,
      now,
      noteId
    );
    await tx.runAsync(`UPDATE person SET updated_at = ? WHERE id = ?`, now, personId);
  });
}

async function deleteNote(noteId: string, personId: string) {
  const db = await getDatabase();
  const now = nowIso();

  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(`DELETE FROM note WHERE id = ?`, noteId);
    await tx.runAsync(`UPDATE person SET updated_at = ? WHERE id = ?`, now, personId);
  });
}

async function renameTag(tagId: string, label: string, color: string) {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE tag SET label = ?, color = ? WHERE id = ?`,
    label.trim(),
    color,
    tagId
  );
}

async function createTag(label: string, color: string = DEFAULT_TAG_COLOR) {
  const db = await getDatabase();
  const now = nowIso();
  const cleanLabel = label.trim();
  if (!cleanLabel) {
    return;
  }

  const existing = await db.getFirstAsync<{ id: string; label: string; color: string | null }>(
    `SELECT id, label, color FROM tag WHERE lower(label) = lower(?) LIMIT 1`,
    cleanLabel
  );
  if (existing) {
    return existing.label;
  }

  await db.runAsync(
    `INSERT INTO tag (id, label, color, created_at) VALUES (?, ?, ?, ?)`,
    randomUUID(),
    cleanLabel,
    color,
    now
  );
  return cleanLabel;
}

async function deleteTag(tagId: string) {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM tag WHERE id = ?`, tagId);
}

export default function App() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 940;
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [tagCatalog, setTagCatalog] = useState<TagRow[]>([]);
  const [activeSection, setActiveSection] = useState<SectionType>('people');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const [tagColorDraft, setTagColorDraft] = useState<string>(DEFAULT_TAG_COLOR);
  const [newTagDraft, setNewTagDraft] = useState('');
  const [newTagColor, setNewTagColor] = useState<string>(DEFAULT_TAG_COLOR);
  const [showTagForm, setShowTagForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [personDraft, setPersonDraft] = useState<PersonDraft>(emptyPersonDraft);
  const [noteDraft, setNoteDraft] = useState<NoteDraft>(emptyNoteDraft);
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const refresh = async (preferredId?: string | null) => {
    try {
      const [nextPeople, nextTagCatalog] = await Promise.all([loadPeople(), loadTagCatalog()]);
      setPeople(nextPeople);
      setTagCatalog(nextTagCatalog);
      setSelectedPersonId((current) => {
        if (preferredId && nextPeople.some((person) => person.id === preferredId)) {
          return preferredId;
        }
        if (current && nextPeople.some((person) => person.id === current)) {
          return current;
        }
        return nextPeople[0]?.id ?? null;
      });
    } catch {
      Alert.alert('Database error', 'Orbit could not load the database.');
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const filteredPeople = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();

    return people.filter((person) => {
      if (activeFilter === 'follow up' && !hasFollowUp(person)) {
        return false;
      }
      if (activeFilter === 'close' && person.relationship !== 'close') {
        return false;
      }
      if (!query) {
        return true;
      }

      const haystack = [
        person.name,
        person.summary ?? '',
        person.company ?? '',
        person.role ?? '',
        person.city ?? '',
        person.school ?? '',
        person.phone ?? '',
        person.email ?? '',
        person.tags.map((tag) => tag.label).join(' '),
        person.notes.map((note) => note.body).join(' '),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [activeFilter, deferredSearchQuery, people]);

  const allNotes = useMemo(
    () =>
      people
        .flatMap((person) =>
          person.notes.map((note) => ({
            ...note,
            person,
          }))
        )
        .sort((left, right) => {
          if (right.pinned !== left.pinned) {
            return right.pinned - left.pinned;
          }
          return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
        }),
    [people]
  );

  const filteredNotes = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    if (!query) {
      return allNotes;
    }

    return allNotes.filter((entry) =>
      [entry.body, entry.type ?? '', entry.person.name, entry.person.company ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [allNotes, deferredSearchQuery]);

  const allTags = useMemo(() => {
    const grouped = new Map<
      string,
      { id: string; label: string; color: string; count: number; people: PersonRecord[] }
    >(
      tagCatalog.map((tag) => [
        tag.id,
        {
          id: tag.id,
          label: tag.label,
          color: normalizeTagColor(tag.color),
          count: 0,
          people: [],
        },
      ])
    );

    people.forEach((person) => {
      person.tags.forEach((tag) => {
        const current = grouped.get(tag.id) ?? {
          id: tag.id,
          label: tag.label,
          color: normalizeTagColor(tag.color),
          count: 0,
          people: [],
        };
        current.count += 1;
        current.people.push(person);
        grouped.set(tag.id, current);
      });
    });

    return Array.from(grouped.values()).sort((left, right) =>
      left.label.localeCompare(right.label)
    );
  }, [people, tagCatalog]);

  const filteredTags = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    if (!query) {
      return allTags;
    }

    return allTags.filter((tag) =>
      [tag.label, ...tag.people.map((person) => person.name)].join(' ').toLowerCase().includes(query)
    );
  }, [allTags, deferredSearchQuery]);

  useEffect(() => {
    if (!filteredPeople.length) {
      setSelectedPersonId(null);
      return;
    }

    if (!selectedPersonId || !filteredPeople.some((person) => person.id === selectedPersonId)) {
      setSelectedPersonId(filteredPeople[0].id);
    }
  }, [filteredPeople, selectedPersonId]);

  useEffect(() => {
    if (!filteredNotes.length) {
      setSelectedNoteId(null);
      return;
    }

    if (!selectedNoteId || !filteredNotes.some((note) => note.id === selectedNoteId)) {
      setSelectedNoteId(filteredNotes[0].id);
    }
  }, [filteredNotes, selectedNoteId]);

  useEffect(() => {
    if (!filteredTags.length) {
      setSelectedTagId(null);
      return;
    }

    if (!selectedTagId || !filteredTags.some((tag) => tag.id === selectedTagId)) {
      setSelectedTagId(filteredTags[0].id);
    }
  }, [filteredTags, selectedTagId]);

  const selectedPerson = useMemo(
    () => people.find((person) => person.id === selectedPersonId) ?? null,
    [people, selectedPersonId]
  );

  const selectedNote = useMemo(
    () => filteredNotes.find((note) => note.id === selectedNoteId) ?? filteredNotes[0] ?? null,
    [filteredNotes, selectedNoteId]
  );

  const selectedTag = useMemo(
    () => filteredTags.find((tag) => tag.id === selectedTagId) ?? filteredTags[0] ?? null,
    [filteredTags, selectedTagId]
  );

  useEffect(() => {
    setTagDraft(selectedTag?.label ?? '');
    setTagColorDraft(selectedTag?.color ?? DEFAULT_TAG_COLOR);
  }, [selectedTag?.id]);

  useEffect(() => {
    if (activeSection === 'people' && people.length === 0) {
      setShowPersonForm(true);
      setMobileDetailOpen(false);
    }
  }, [activeSection, people.length]);

  const factCells = selectedPerson
    ? buildCells([
        ['Company', selectedPerson.company],
        ['Role', selectedPerson.role],
        ['City', selectedPerson.city],
        ['School', selectedPerson.school],
        ['Phone', selectedPerson.phone],
        ['Met at', selectedPerson.met_at],
        ['Met date', selectedPerson.met_date ? formatDate(selectedPerson.met_date) : null],
        ['Relationship', selectedPerson.relationship],
        ['Follow up', selectedPerson.follow_up_date ? formatDate(selectedPerson.follow_up_date) : null],
      ])
    : [];

  const socialCells = selectedPerson
    ? buildCells([
        ['Email', selectedPerson.email],
        ['Instagram', selectedPerson.instagram],
        ['LinkedIn', selectedPerson.linkedin],
        ['Twitter', selectedPerson.twitter],
        ['Website', selectedPerson.website],
      ])
    : [];

  const savePerson = async () => {
    if (!personDraft.name.trim()) {
      Alert.alert('Missing name', 'Add a name before saving.');
      return;
    }

    try {
      let targetPersonId = editingPersonId;
      if (editingPersonId) {
        await updatePerson(editingPersonId, personDraft);
      } else {
        const personId = await insertPerson(personDraft);
        setSelectedPersonId(personId);
        targetPersonId = personId;
      }
      setPersonDraft(emptyPersonDraft);
      setShowPersonForm(false);
      setEditingPersonId(null);
      await refresh(targetPersonId);
    } catch {
      Alert.alert('Database error', 'Orbit could not save this person.');
    }
  };

  const saveNote = async () => {
    if (!selectedPerson || !noteDraft.body.trim()) {
      Alert.alert('Empty note', 'Add note text before saving.');
      return;
    }

    try {
      if (editingNoteId) {
        await updateNote(editingNoteId, selectedPerson.id, noteDraft);
      } else {
        await insertNote(selectedPerson.id, noteDraft);
      }
      setNoteDraft(emptyNoteDraft);
      setEditingNoteId(null);
      await refresh(selectedPerson.id);
    } catch {
      Alert.alert('Database error', 'Orbit could not save this note.');
    }
  };

  const selectPerson = (id: string) => {
    setSelectedPersonId(id);
    if (!isDesktop) setMobileDetailOpen(true);
  };

  const selectNote = (id: string) => {
    setSelectedNoteId(id);
    if (!isDesktop) setMobileDetailOpen(true);
  };

  const selectTag = (id: string) => {
    setSelectedTagId(id);
    if (!isDesktop) setMobileDetailOpen(true);
  };

  const goBack = () => setMobileDetailOpen(false);

  const availableTags = useMemo<TagOption[]>(
    () => allTags.map((tag) => ({ id: tag.id, label: tag.label, color: tag.color })),
    [allTags]
  );

  const createPersonFormTag = async (label: string, color: string = DEFAULT_TAG_COLOR): Promise<string | null> => {
    const trimmed = label.trim();
    if (!trimmed) return null;
    const existing = allTags.find((t) => t.label.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing.label;
    try {
      await createTag(trimmed, color);
      await refresh(selectedPersonId);
      return trimmed;
    } catch {
      return null;
    }
  };

  const importContact = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Unavailable', 'Contact import is only available on iOS and Android.');
      return;
    }

    try {
      const permission = await Contacts.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Allow contacts access to import a person.');
        return;
      }

      const picked = await Contacts.presentContactPickerAsync();
      if (!picked?.id) {
        return;
      }

      const contact = await Contacts.getContactByIdAsync(picked.id, [
        Contacts.Fields.Name,
        Contacts.Fields.Emails,
        Contacts.Fields.PhoneNumbers,
        Contacts.Fields.Company,
        Contacts.Fields.JobTitle,
        Contacts.Fields.Addresses,
      ]);

      if (!contact?.name?.trim()) {
        Alert.alert('Import failed', 'This contact does not have a usable name.');
        return;
      }

      const primaryPhone =
        contact.phoneNumbers?.find((entry) => entry.isPrimary)?.number ??
        contact.phoneNumbers?.[0]?.number ??
        '';
      const primaryEmail =
        contact.emails?.find((entry) => entry.isPrimary)?.email ??
        contact.emails?.[0]?.email ??
        '';
      const primaryCity =
        contact.addresses?.find((entry) => entry.city)?.city ??
        contact.addresses?.[0]?.city ??
        '';

      setEditingPersonId(null);
      setPersonDraft({
        ...emptyPersonDraft,
        name: contact.name,
        company: contact.company ?? '',
        role: contact.jobTitle ?? '',
        city: primaryCity,
        phone: primaryPhone,
        email: primaryEmail,
      });
      setShowPersonForm(true);
      setActiveSection('people');
      setMobileDetailOpen(false);
    } catch {
      Alert.alert('Import failed', 'Orbit could not import that contact.');
    }
  };

  const startEditPerson = (person: PersonRecord) => {
    setEditingPersonId(person.id);
    setPersonDraft({
      name: person.name,
      summary: person.summary ?? '',
      company: person.company ?? '',
      role: person.role ?? '',
      city: person.city ?? '',
      school: person.school ?? '',
      phone: person.phone ?? '',
      metAt: person.met_at ?? '',
      metDate: person.met_date ?? '',
      relationship: person.relationship ?? 'acquaintance',
      email: person.email ?? '',
      instagram: person.instagram ?? '',
      linkedin: person.linkedin ?? '',
      twitter: person.twitter ?? '',
      website: person.website ?? '',
      followUpDate: person.follow_up_date ?? '',
      tags: person.tags.map((tag) => tag.label),
    });
    setShowPersonForm(true);
    if (!isDesktop) setMobileDetailOpen(true);
  };

  const removePerson = async (personId: string) => {
    try {
      await deletePerson(personId);
      if (editingPersonId === personId) {
        setEditingPersonId(null);
        setPersonDraft(emptyPersonDraft);
        setShowPersonForm(false);
      }
      await refresh();
    } catch {
      Alert.alert('Database error', 'Orbit could not delete this person.');
    }
  };

  const startEditNote = (note: NoteRow) => {
    setEditingNoteId(note.id);
    setNoteDraft({
      type: note.type ?? 'free',
      body: note.body,
      pinned: Boolean(note.pinned),
    });
    setActiveSection('people');
  };

  const removeNote = async (noteId: string, personId: string) => {
    try {
      await deleteNote(noteId, personId);
      if (editingNoteId === noteId) {
        setEditingNoteId(null);
        setNoteDraft(emptyNoteDraft);
      }
      await refresh(personId);
    } catch {
      Alert.alert('Database error', 'Orbit could not delete this note.');
    }
  };

  const saveTag = async () => {
    if (!selectedTag || !tagDraft.trim()) {
      return;
    }

    try {
      await renameTag(selectedTag.id, tagDraft, tagColorDraft);
      await refresh(selectedPersonId);
    } catch {
      Alert.alert('Database error', 'Orbit could not rename this tag.');
    }
  };

  const saveNewTag = async () => {
    if (!newTagDraft.trim()) {
      return;
    }

    try {
      await createTag(newTagDraft, newTagColor);
      setNewTagDraft('');
      setNewTagColor(DEFAULT_TAG_COLOR);
      setShowTagForm(false);
      await refresh(selectedPersonId);
    } catch {
      Alert.alert('Database error', 'Orbit could not create this tag.');
    }
  };

  const removeTag = async (tagId: string) => {
    try {
      await deleteTag(tagId);
      await refresh(selectedPersonId);
    } catch {
      Alert.alert('Database error', 'Orbit could not delete this tag.');
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.flex}>
          <Starfield />
          {(!mobileDetailOpen || isDesktop) ? (
            <>
              <View style={styles.header}>
                <SvgXml xml={ORBIT_LOGO_SVG} width={32} height={32} />
                <Text style={styles.pageTitle}>Orbit</Text>
              </View>

              <View style={styles.toolbar}>
                <View style={styles.searchShell}>
                  <TextInput
                    onChangeText={setSearchQuery}
                    placeholder="Search..."
                    placeholderTextColor="#3a3a44"
                    style={styles.searchInput}
                    value={searchQuery}
                  />
                </View>
                {activeSection === 'people' ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                    {FILTERS.map((filter) => (
                      <Chip
                        key={filter}
                        active={filter === activeFilter}
                        label={filter}
                        onPress={() => setActiveFilter(filter)}
                      />
                    ))}
                  </ScrollView>
                ) : null}
              </View>
            </>
          ) : null}

          {activeSection === 'people' ? (
            <PeopleSection
              availableTags={availableTags}
              createPersonFormTag={createPersonFormTag}
              editingNoteId={editingNoteId}
              editingPersonId={editingPersonId}
              factCells={factCells}
              filteredPeople={filteredPeople}
              isDesktop={isDesktop}
              mobileDetailOpen={mobileDetailOpen}
              noteDraft={noteDraft}
              onBack={goBack}
              onImportContact={importContact}
              personDraft={personDraft}
              removeNote={removeNote}
              removePerson={removePerson}
              saveNote={saveNote}
              savePerson={savePerson}
              socialCells={socialCells}
              selectedPerson={selectedPerson}
              selectedPersonId={selectedPersonId}
              startEditNote={startEditNote}
              startEditPerson={startEditPerson}
              setNoteDraft={setNoteDraft}
              setPersonDraft={setPersonDraft}
              selectPerson={selectPerson}
              setShowPersonForm={setShowPersonForm}
              showPersonForm={showPersonForm}
            />
          ) : activeSection === 'notes' ? (
            <NotesSection
              filteredNotes={filteredNotes}
              isDesktop={isDesktop}
              mobileDetailOpen={mobileDetailOpen}
              onBack={goBack}
              onDeleteNote={removeNote}
              onEditNote={(note) => {
                startEditNote(note);
                selectPerson(note.person.id);
              }}
              selectedNote={selectedNote}
              selectedNoteId={selectedNoteId}
              onOpenPerson={(personId) => {
                selectPerson(personId);
                setActiveSection('people');
              }}
              onSelectNote={selectNote}
            />
          ) : (
            <TagsSection
              filteredTags={filteredTags}
              isDesktop={isDesktop}
              mobileDetailOpen={mobileDetailOpen}
              onBack={goBack}
              onCreateTag={saveNewTag}
              onOpenPerson={(personId) => {
                selectPerson(personId);
                setActiveSection('people');
              }}
              onDeleteTag={removeTag}
              onNewTagColorChange={setNewTagColor}
              onNewTagDraftChange={setNewTagDraft}
              onSelectTag={selectTag}
              onShowTagForm={setShowTagForm}
              onTagColorDraftChange={setTagColorDraft}
              onTagDraftChange={setTagDraft}
              onTagSave={saveTag}
              newTagColor={newTagColor}
              newTagDraft={newTagDraft}
              selectedTag={selectedTag}
              selectedTagId={selectedTagId}
              showTagForm={showTagForm}
              tagColorDraft={tagColorDraft}
              tagDraft={tagDraft}
            />
          )}

        </View>
      </KeyboardAvoidingView>
      <View style={styles.bottomNav}>
        <Pressable style={styles.navItem} onPress={() => { setActiveSection('people'); setMobileDetailOpen(false); }}>
          <PeopleIcon color={activeSection === 'people' ? '#a0a0b0' : '#3a3a44'} />
          <Text style={[styles.navLabel, activeSection === 'people' && styles.navActive]}>People</Text>
        </Pressable>
        <Pressable style={styles.navItem} onPress={() => { setActiveSection('notes'); setMobileDetailOpen(false); }}>
          <NotesIcon color={activeSection === 'notes' ? '#a0a0b0' : '#3a3a44'} />
          <Text style={[styles.navLabel, activeSection === 'notes' && styles.navActive]}>Notes</Text>
        </Pressable>
        <Pressable style={styles.navItem} onPress={() => { setActiveSection('tags'); setMobileDetailOpen(false); }}>
          <TagsIcon color={activeSection === 'tags' ? '#a0a0b0' : '#3a3a44'} />
          <Text style={[styles.navLabel, activeSection === 'tags' && styles.navActive]}>Tags</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function PersonForm({
  availableTags,
  onCreateTag,
  draft,
  setDraft,
  editingPersonId,
  onSave,
}: {
  availableTags: TagOption[];
  onCreateTag: (label: string, color?: string) => Promise<string | null>;
  draft: PersonDraft;
  setDraft: (fn: (current: PersonDraft) => PersonDraft) => void;
  editingPersonId: string | null;
  onSave: () => void;
}) {
  const hasSecondary = Boolean(
    draft.school || draft.metDate || draft.followUpDate || draft.tags.length || draft.summary
  );
  const [showMore, setShowMore] = useState(hasSecondary);

  return (
    <View style={styles.formSection}>
      <Text style={styles.formHeading}>{editingPersonId ? 'Edit person' : 'New person'}</Text>
      <Field
        label="Name"
        value={draft.name}
        onChangeText={(v) => setDraft((c) => ({ ...c, name: v }))}
      />
      <Text style={styles.fieldLabel}>Relationship</Text>
      <View style={styles.typeRow}>
        {RELATIONSHIPS.map((rel) => (
          <TagChip
            key={rel}
            label={rel}
            active={draft.relationship === rel}
            onPress={() => setDraft((c) => ({ ...c, relationship: rel }))}
          />
        ))}
      </View>
      <View style={styles.formPairRow}>
        <View style={styles.formPairCell}>
          <Field label="Company" value={draft.company} onChangeText={(v) => setDraft((c) => ({ ...c, company: v }))} />
        </View>
        <View style={styles.formPairCell}>
          <Field label="Role" value={draft.role} onChangeText={(v) => setDraft((c) => ({ ...c, role: v }))} />
        </View>
      </View>
      <View style={styles.formPairRow}>
        <View style={styles.formPairCell}>
          <Field label="City" value={draft.city} onChangeText={(v) => setDraft((c) => ({ ...c, city: v }))} />
        </View>
        <View style={styles.formPairCell}>
          <Field label="Phone" value={draft.phone} onChangeText={(v) => setDraft((c) => ({ ...c, phone: v }))} />
        </View>
      </View>
      <View style={styles.formPairRow}>
        <View style={styles.formPairCell}>
          <Field label="Met at" value={draft.metAt} onChangeText={(v) => setDraft((c) => ({ ...c, metAt: v }))} />
        </View>
        <View style={styles.formPairCell} />
      </View>
      <Pressable onPress={() => setShowMore((s) => !s)} style={styles.moreToggle}>
        <Text style={styles.moreToggleText}>{showMore ? '− Less details' : '+ More details'}</Text>
      </Pressable>
      {showMore ? (
        <View style={styles.formGrid}>
          <Field label="School" value={draft.school} onChangeText={(v) => setDraft((c) => ({ ...c, school: v }))} />
          <DateField label="Met date" value={draft.metDate} onChange={(v) => setDraft((c) => ({ ...c, metDate: v }))} />
          <DateField label="Follow up" value={draft.followUpDate} onChange={(v) => setDraft((c) => ({ ...c, followUpDate: v }))} />
          <Field
            label="Email"
            value={draft.email}
            onChangeText={(v) => setDraft((c) => ({ ...c, email: v }))}
          />
          <Field
            label="Instagram"
            value={draft.instagram}
            onChangeText={(v) => setDraft((c) => ({ ...c, instagram: v }))}
          />
          <Field
            label="LinkedIn"
            value={draft.linkedin}
            onChangeText={(v) => setDraft((c) => ({ ...c, linkedin: v }))}
          />
          <Field
            label="Twitter"
            value={draft.twitter}
            onChangeText={(v) => setDraft((c) => ({ ...c, twitter: v }))}
          />
          <Field
            label="Website"
            value={draft.website}
            onChangeText={(v) => setDraft((c) => ({ ...c, website: v }))}
          />
          <TagMultiSelect
            availableTags={availableTags}
            label="Tags"
            onCreateTag={async (label, color) => {
              const created = await onCreateTag(label, color);
              if (!created) {
                return null;
              }
              setDraft((c) => ({
                ...c,
                tags: c.tags.includes(created) ? c.tags : [...c.tags, created],
              }));
              return created;
            }}
            onChange={(tags) => setDraft((c) => ({ ...c, tags }))}
            selectedTags={draft.tags}
          />
          <Field label="Summary" multiline value={draft.summary} onChangeText={(v) => setDraft((c) => ({ ...c, summary: v }))} />
        </View>
      ) : null}
      <Pressable onPress={onSave} style={[styles.primaryButton, styles.formSaveButton]}>
        <Text style={styles.primaryButtonText}>{editingPersonId ? 'Update person' : 'Save person'}</Text>
      </Pressable>
    </View>
  );
}

function PeopleSection({
  availableTags,
  createPersonFormTag,
  editingNoteId,
  editingPersonId,
  factCells,
  filteredPeople,
  isDesktop,
  mobileDetailOpen,
  noteDraft,
  onBack,
  onImportContact,
  personDraft,
  removeNote,
  removePerson,
  saveNote,
  savePerson,
  socialCells,
  selectedPerson,
  selectedPersonId,
  startEditNote,
  startEditPerson,
  setNoteDraft,
  setPersonDraft,
  selectPerson,
  setShowPersonForm,
  showPersonForm,
}: {
  availableTags: TagOption[];
  createPersonFormTag: (label: string, color?: string) => Promise<string | null>;
  editingNoteId: string | null;
  editingPersonId: string | null;
  factCells: string[][];
  filteredPeople: PersonRecord[];
  isDesktop: boolean;
  mobileDetailOpen: boolean;
  noteDraft: NoteDraft;
  onBack: () => void;
  onImportContact: () => void;
  personDraft: PersonDraft;
  removeNote: (noteId: string, personId: string) => void;
  removePerson: (personId: string) => void;
  saveNote: () => void;
  savePerson: () => void;
  socialCells: string[][];
  selectedPerson: PersonRecord | null;
  selectedPersonId: string | null;
  startEditNote: (note: NoteRow) => void;
  startEditPerson: (person: PersonRecord) => void;
  setNoteDraft: (value: (current: NoteDraft) => NoteDraft) => void;
  setPersonDraft: (value: (current: PersonDraft) => PersonDraft) => void;
  selectPerson: (value: string) => void;
  setShowPersonForm: (value: (current: boolean) => boolean) => void;
  showPersonForm: boolean;
}) {
  const showDetail = isDesktop || mobileDetailOpen;
  const showList = isDesktop || !mobileDetailOpen;

  const detailContent = (
    <ScrollView style={[styles.detailPane, isDesktop && styles.detailPaneDesktop]} showsVerticalScrollIndicator={false}>
      {selectedPerson ? (
        <>
          {!isDesktop ? (
            <View style={styles.detailHeader}>
              <Pressable onPress={onBack} style={styles.backButton}>
                <Text style={styles.backButtonText}>{'\u2039'} Back</Text>
              </Pressable>
              <View style={styles.actionRow}>
                <Pressable onPress={() => startEditPerson(selectedPerson)} style={styles.ghostButton}>
                  <Text style={styles.ghostButtonText}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => removePerson(selectedPerson.id)} style={styles.dangerButton}>
                  <Text style={styles.dangerButtonText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

            <View style={styles.profileSection}>
              <View style={styles.profileTop}>
                <Avatar name={selectedPerson.name} pending={hasFollowUp(selectedPerson)} large />
                <View style={styles.profileMeta}>
                  <Text style={styles.profileName}>{selectedPerson.name}</Text>
                  <Text style={styles.profileSubline}>{selectedPerson.summary ?? selectedPerson.role ?? 'No summary'}</Text>
                </View>
              </View>
              {factCells.length > 0 ? <FactGrid cells={factCells} /> : null}
              {socialCells.length > 0 ? (
                <View style={styles.subsectionBlock}>
                  <Text style={styles.sectionLabel}>Socials</Text>
                  <FactGrid cells={socialCells} />
                </View>
              ) : null}
              <View style={styles.tagRow}>
                {selectedPerson.tags.length > 0 ? selectedPerson.tags.map((tag) => <TagPill key={tag.id} color={tag.color} label={tag.label} />) : <Text style={styles.ghostText}>No tags</Text>}
              </View>
            </View>

          {showPersonForm ? (
            <PersonForm
              availableTags={availableTags}
              draft={personDraft}
              setDraft={setPersonDraft}
              editingPersonId={editingPersonId}
              onCreateTag={createPersonFormTag}
              onSave={savePerson}
            />
          ) : null}

          <View style={styles.noteComposerSection}>
            <Text style={styles.sectionLabel}>{editingNoteId ? 'Edit note' : 'New note'}</Text>
            <View style={styles.typeRow}>
              {NOTE_TYPES.map((type) => (
                <NoteTypePill key={type} label={type} active={noteDraft.type === type} onPress={() => setNoteDraft((current) => ({ ...current, type }))} />
              ))}
            </View>
            <Field label="Body" multiline value={noteDraft.body} onChangeText={(value) => setNoteDraft((current) => ({ ...current, body: value }))} />
            <View style={styles.typeRow}>
              <TagChip label="Pinned" active={noteDraft.pinned} onPress={() => setNoteDraft((current) => ({ ...current, pinned: !current.pinned }))} />
            </View>
            <Pressable onPress={saveNote} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{editingNoteId ? 'Update note' : 'Save note'}</Text>
            </Pressable>
          </View>

          <View style={styles.notesSection}>
            <Text style={styles.sectionLabel}>Notes</Text>
            {selectedPerson.notes.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No notes</Text>
                <Text style={styles.emptyBody}>Start with a quick memory or context line.</Text>
              </View>
            ) : (
              selectedPerson.notes.map((note) => (
                <View key={note.id} style={styles.noteCard}>
                  <View style={styles.noteCardTop}>
                    <NoteTypePill label={note.type ?? 'free'} active onPress={() => undefined} />
                    <Text style={styles.noteDate}>{formatDate(note.updated_at)}</Text>
                  </View>
                  <Text style={styles.noteBody}>{note.body}</Text>
                  <View style={styles.noteActionRow}>
                    <Pressable onPress={() => startEditNote(note)} style={styles.inlineAction}>
                      <Text style={styles.inlineActionText}>Edit</Text>
                    </Pressable>
                    <Pressable onPress={() => removeNote(note.id, selectedPerson.id)} style={styles.inlineAction}>
                      <Text style={styles.inlineDangerText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        </>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No person selected</Text>
          <Text style={styles.emptyBody}>Choose a row from the database.</Text>
        </View>
      )}
    </ScrollView>
  );

  return (
    <View style={[styles.content, isDesktop && styles.contentDesktop]}>
      {showList ? (
        <View style={[styles.listPane, isDesktop && styles.listPaneDesktop]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Database</Text>
            <View style={styles.actionRow}>
              <Pressable onPress={onImportContact} style={styles.ghostButton}>
                <Text style={styles.ghostButtonText}>Import</Text>
              </Pressable>
              {isDesktop && selectedPerson ? (
                <>
                  <Pressable onPress={() => startEditPerson(selectedPerson)} style={styles.ghostButton}>
                    <Text style={styles.ghostButtonText}>Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => removePerson(selectedPerson.id)} style={styles.dangerButton}>
                    <Text style={styles.dangerButtonText}>Delete</Text>
                  </Pressable>
                </>
              ) : null}
              <Pressable onPress={() => setShowPersonForm((current) => !current)} style={styles.ghostButton}>
                <Text style={styles.ghostButtonText}>{showPersonForm ? 'Close' : '+ New'}</Text>
              </Pressable>
            </View>
          </View>

          {showPersonForm && !mobileDetailOpen ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <PersonForm
                availableTags={availableTags}
                draft={personDraft}
                setDraft={setPersonDraft}
                editingPersonId={editingPersonId}
                onCreateTag={createPersonFormTag}
                onSave={savePerson}
              />
            </ScrollView>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {filteredPeople.length === 0 ? (
                <Pressable onPress={() => setShowPersonForm(() => true)} style={styles.emptyAddPrompt}>
                  <View style={styles.emptyAddCircle}>
                    <Text style={styles.emptyAddPlus}>+</Text>
                  </View>
                  <Text style={styles.emptyAddLabel}>Add to your Orbit</Text>
                </Pressable>
              ) : (
                filteredPeople.map((person) => (
                  <PersonRowView key={person.id} active={person.id === selectedPersonId} person={person} onPress={() => selectPerson(person.id)} />
                ))
              )}
            </ScrollView>
          )}
        </View>
      ) : null}

      {showDetail ? detailContent : null}
    </View>
  );
}

function NotesSection({
  filteredNotes,
  isDesktop,
  mobileDetailOpen,
  onBack,
  onDeleteNote,
  onEditNote,
  selectedNote,
  selectedNoteId,
  onOpenPerson,
  onSelectNote,
}: {
  filteredNotes: Array<NoteRow & { person: PersonRecord }>;
  isDesktop: boolean;
  mobileDetailOpen: boolean;
  onBack: () => void;
  onDeleteNote: (noteId: string, personId: string) => void;
  onEditNote: (note: NoteRow & { person: PersonRecord }) => void;
  selectedNote: (NoteRow & { person: PersonRecord }) | null;
  selectedNoteId: string | null;
  onOpenPerson: (personId: string) => void;
  onSelectNote: (noteId: string) => void;
}) {
  const showDetail = isDesktop || mobileDetailOpen;
  const showList = isDesktop || !mobileDetailOpen;

  return (
    <View style={[styles.content, isDesktop && styles.contentDesktop]}>
      {showList ? (
        <View style={[styles.listPane, isDesktop && styles.listPaneDesktop]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>All notes</Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {filteredNotes.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No notes</Text>
                <Text style={styles.emptyBody}>Create a note from a person record.</Text>
              </View>
            ) : (
              filteredNotes.map((entry) => (
                <Pressable key={entry.id} onPress={() => onSelectNote(entry.id)} style={[styles.noteListRow, entry.id === selectedNoteId && styles.rowActive]}>
                  <View style={styles.noteCardTop}>
                    <NoteTypePill label={entry.type ?? 'free'} active onPress={() => undefined} />
                    {entry.pinned ? <Text style={styles.inlineMuted}>Pinned</Text> : null}
                  </View>
                  <Text numberOfLines={2} style={styles.noteBody}>{entry.body}</Text>
                  <Text style={styles.inlineMuted}>{entry.person.name}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      ) : null}

      {showDetail ? (
        <View style={[styles.detailPane, isDesktop && styles.detailPaneDesktop]}>
          {selectedNote ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              {!isDesktop ? (
                <View style={styles.detailHeader}>
                  <Pressable onPress={onBack} style={styles.backButton}>
                    <Text style={styles.backButtonText}>{'\u2039'} Back</Text>
                  </Pressable>
                  <View style={styles.actionRow}>
                    <Pressable onPress={() => onEditNote(selectedNote)} style={styles.ghostButton}>
                      <Text style={styles.ghostButtonText}>Edit</Text>
                    </Pressable>
                    <Pressable onPress={() => onDeleteNote(selectedNote.id, selectedNote.person.id)} style={styles.dangerButton}>
                      <Text style={styles.dangerButtonText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <View style={styles.profileSection}>
                <View style={styles.noteCardTop}>
                  <NoteTypePill label={selectedNote.type ?? 'free'} active onPress={() => undefined} />
                  <Text style={styles.noteDate}>{formatDate(selectedNote.updated_at)}</Text>
                </View>
                <Text style={[styles.noteBody, { marginTop: 8 }]}>{selectedNote.body}</Text>
                {isDesktop ? (
                  <View style={styles.noteActionRow}>
                    <Pressable onPress={() => onEditNote(selectedNote)} style={styles.inlineAction}>
                      <Text style={styles.inlineActionText}>Edit</Text>
                    </Pressable>
                    <Pressable onPress={() => onDeleteNote(selectedNote.id, selectedNote.person.id)} style={styles.inlineAction}>
                      <Text style={styles.inlineDangerText}>Delete</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
              <Pressable onPress={() => onOpenPerson(selectedNote.person.id)} style={styles.linkSection}>
                <Text style={styles.sectionLabel}>Person</Text>
                <Text style={styles.profileName}>{selectedNote.person.name}</Text>
                <Text style={styles.profileSubline}>{selectedNote.person.summary ?? selectedNote.person.role ?? 'Open person record'}</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No note selected</Text>
              <Text style={styles.emptyBody}>Choose a note from the list.</Text>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

function TagsSection({
  filteredTags,
  isDesktop,
  mobileDetailOpen,
  onBack,
  onCreateTag,
  onDeleteTag,
  onNewTagColorChange,
  onNewTagDraftChange,
  onOpenPerson,
  onSelectTag,
  onShowTagForm,
  onTagColorDraftChange,
  onTagDraftChange,
  onTagSave,
  newTagColor,
  newTagDraft,
  selectedTag,
  selectedTagId,
  showTagForm,
  tagColorDraft,
  tagDraft,
}: {
  filteredTags: Array<{ id: string; label: string; color: string; count: number; people: PersonRecord[] }>;
  isDesktop: boolean;
  mobileDetailOpen: boolean;
  onBack: () => void;
  onCreateTag: () => void;
  onDeleteTag: (tagId: string) => void;
  onNewTagColorChange: (value: string) => void;
  onNewTagDraftChange: (value: string) => void;
  onOpenPerson: (personId: string) => void;
  onSelectTag: (tagId: string) => void;
  onShowTagForm: (value: (current: boolean) => boolean) => void;
  onTagColorDraftChange: (value: string) => void;
  onTagDraftChange: (value: string) => void;
  onTagSave: () => void;
  newTagColor: string;
  newTagDraft: string;
  selectedTag: { id: string; label: string; color: string; count: number; people: PersonRecord[] } | null;
  selectedTagId: string | null;
  showTagForm: boolean;
  tagColorDraft: string;
  tagDraft: string;
}) {
  const showDetail = isDesktop || mobileDetailOpen;
  const showList = isDesktop || !mobileDetailOpen;

  return (
    <View style={[styles.content, isDesktop && styles.contentDesktop]}>
      {showList ? (
        <View style={[styles.listPane, isDesktop && styles.listPaneDesktop]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>All tags</Text>
            <Pressable onPress={() => onShowTagForm((current) => !current)} style={styles.ghostButton}>
              <Text style={styles.ghostButtonText}>{showTagForm ? 'Close' : '+ New'}</Text>
            </Pressable>
          </View>
          {showTagForm ? (
            <View style={styles.formSection}>
              <Text style={styles.formHeading}>New tag</Text>
              <Field label="Label" value={newTagDraft} onChangeText={onNewTagDraftChange} />
              <ColorPicker label="Color" selectedColor={newTagColor} onChange={onNewTagColorChange} />
              <Pressable onPress={onCreateTag} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Create tag</Text>
              </Pressable>
            </View>
          ) : null}
          <ScrollView showsVerticalScrollIndicator={false}>
            {filteredTags.length === 0 ? (
              <Pressable onPress={() => onShowTagForm(() => true)} style={styles.emptyAddPrompt}>
                <View style={styles.emptyAddCircle}>
                  <Text style={styles.emptyAddPlus}>+</Text>
                </View>
                <Text style={styles.emptyAddLabel}>Add to your Orbit</Text>
              </Pressable>
            ) : (
              filteredTags.map((tag) => (
                <Pressable key={tag.id} onPress={() => onSelectTag(tag.id)} style={[styles.tagListRow, tag.id === selectedTagId && styles.rowActive]}>
                  <TagPill color={tag.color} label={tag.label} />
                  <Text style={styles.inlineMuted}>{tag.count} people</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      ) : null}

      {showDetail ? (
        <View style={[styles.detailPane, isDesktop && styles.detailPaneDesktop]}>
          {selectedTag ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              {!isDesktop ? (
                <View style={styles.detailHeader}>
                  <Pressable onPress={onBack} style={styles.backButton}>
                    <Text style={styles.backButtonText}>{'\u2039'} Back</Text>
                  </Pressable>
                  <View style={styles.actionRow}>
                    <Pressable onPress={onTagSave} style={styles.ghostButton}>
                      <Text style={styles.ghostButtonText}>Rename</Text>
                    </Pressable>
                    <Pressable onPress={() => onDeleteTag(selectedTag.id)} style={styles.dangerButton}>
                      <Text style={styles.dangerButtonText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <View style={styles.profileSection}>
                <Field label="Label" value={tagDraft} onChangeText={onTagDraftChange} />
                <ColorPicker label="Color" selectedColor={tagColorDraft} onChange={onTagColorDraftChange} />
                <Text style={styles.profileSubline}>{selectedTag.count} linked people</Text>
                {isDesktop ? (
                  <View style={styles.noteActionRow}>
                    <Pressable onPress={onTagSave} style={styles.inlineAction}>
                      <Text style={styles.inlineActionText}>Rename</Text>
                    </Pressable>
                    <Pressable onPress={() => onDeleteTag(selectedTag.id)} style={styles.inlineAction}>
                      <Text style={styles.inlineDangerText}>Delete</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
              <View style={styles.notesSection}>
                <Text style={styles.sectionLabel}>People</Text>
                {selectedTag.people.map((person) => (
                  <Pressable key={person.id} onPress={() => onOpenPerson(person.id)} style={styles.tagLinkedRow}>
                    <Avatar name={person.name} pending={hasFollowUp(person)} />
                    <View style={styles.rowContent}>
                      <Text style={styles.personName}>{person.name}</Text>
                      <Text style={styles.personSubtitle}>{person.company ?? person.role ?? 'Open person record'}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No tag selected</Text>
              <Text style={styles.emptyBody}>Choose a tag from the list.</Text>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

type BackgroundStar = {
  idx: number;
  size: number;
  base: number;
  speed: number;
  offset: number;
  lifeSpeed: number;
  lifeOffset: number;
};

type ShootingStar = {
  id: number;
  x: number;
  y: number;
  angle: number;
  length: number;
  born: number;
  duration: number;
};

function useStarfield() {
  const bgStars = useMemo<BackgroundStar[]>(() =>
    Array.from({ length: 50 }, (_, i) => ({
      idx: i,
      size: 1.5 + Math.random() * 2,
      base: 0.03 + Math.random() * 0.05,
      speed: 0.0008 + Math.random() * 0.0015,
      offset: i * 2.3,
      lifeSpeed: 0.00010 + Math.random() * 0.00020,
      lifeOffset: Math.random() * Math.PI * 2,
    })), []);

  const [time, setTime] = useState(0);
  const [shooters, setShooters] = useState<ShootingStar[]>([]);
  const nextId = useMemo(() => ({ current: 0 }), []);

  useEffect(() => {
    let frame = 0;
    let lastShooter = 0;

    const animate = (now: number) => {
      setTime(now);

      if (now - lastShooter > 4000 + Math.random() * 8000) {
        lastShooter = now;
        const id = nextId.current++;
        const shooter: ShootingStar = {
          id,
          x: 0.1 + Math.random() * 0.6,
          y: Math.random() * 0.4,
          angle: 0.4 + Math.random() * 0.5,
          length: 40 + Math.random() * 30,
          born: now,
          duration: 600 + Math.random() * 400,
        };
        setShooters((prev) => [...prev.slice(-2), shooter]);
      }

      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [nextId]);

  return { bgStars, time, shooters };
}

function Starfield() {
  const { width, height } = useWindowDimensions();
  const { bgStars, time, shooters } = useStarfield();

  // Sky slowly pans: full 360° rotation every ~55 min
  const centerRA = (time * 0.00011) % 360;
  const centerDec = 15; // slightly northern sky
  const scale = width / 90; // pixels per degree of sky

  const project = (raDeg: number, decDeg: number) => {
    const ra = normalizeRA(raDeg);
    let dRA = ra - normalizeRA(centerRA);
    if (dRA > 180) dRA -= 360;
    if (dRA < -180) dRA += 360;
    return {
      x: width / 2 + dRA * scale,
      y: height / 2 - (decDeg - centerDec) * scale,
    };
  };

  const onScreen = (x: number, y: number) =>
    x >= -20 && x <= width + 20 && y >= -20 && y <= height + 20;

  return (
    <View pointerEvents="none" style={styles.starfield}>
      {/* Faint background stars — simple dots */}
      {bgStars.map((star) => {
        const phase = time * star.lifeSpeed + star.lifeOffset;
        const life = 0.5 + 0.5 * Math.sin(phase);
        if (life <= 0.2) return null;
        const opacity = star.base * Math.min(1, (life - 0.2) / 0.15) *
          (0.6 + 0.4 * Math.sin(time * star.speed + star.offset));
        const cycle = Math.floor(phase / Math.PI);
        const seed = cycle * 127 + star.idx * 311;
        const sx = ((seed * 16807 + 7) % 2147483647) / 2147483647;
        const sy = ((seed * 48271 + 11) % 2147483647) / 2147483647;
        return (
          <View
            key={star.idx}
            style={{
              position: 'absolute',
              left: `${sx * 100}%`,
              top: `${sy * 100}%`,
              width: star.size,
              height: star.size,
              borderRadius: star.size,
              backgroundColor: '#ffffff',
              opacity,
            }}
          />
        );
      })}

      {/* Constellation lines */}
      {CONSTELLATION_LINES.flatMap((c) =>
        c.lines.flatMap((segment, si) => {
          const segs: React.ReactNode[] = [];
          for (let i = 0; i < segment.length - 1; i++) {
            const p1 = project(segment[i][0], segment[i][1]);
            const p2 = project(segment[i + 1][0], segment[i + 1][1]);
            if (!onScreen(p1.x, p1.y) && !onScreen(p2.x, p2.y)) continue;
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 1) continue;
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            segs.push(
              <View
                key={`${c.id}-${si}-${i}`}
                style={{
                  position: 'absolute',
                  left: (p1.x + p2.x) / 2 - len / 2,
                  top: (p1.y + p2.y) / 2 - 0.5,
                  width: len,
                  height: 1,
                  backgroundColor: '#8b7cf0',
                  opacity: 0.18,
                  transform: [{ rotate: `${angle}deg` }],
                }}
              />
            );
          }
          return segs;
        })
      )}

      {/* Real bright stars — sparkle shape, sized by magnitude */}
      {BRIGHT_STARS.map((star) => {
        const { x, y } = project(star.ra, star.dec);
        if (!onScreen(x, y)) return null;
        const size = Math.max(3, (5 - star.mag) * 1.5);
        const arm = Math.max(0.5, size * 0.18);
        return (
          <View
            key={star.hip}
            style={{
              position: 'absolute',
              left: x - size / 2,
              top: y - size / 2,
              width: size,
              height: size,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.9,
            }}
          >
            <View style={{ position: 'absolute', width: size, height: arm, borderRadius: arm * 0.5, backgroundColor: '#ffffff' }} />
            <View style={{ position: 'absolute', width: arm, height: size, borderRadius: arm * 0.5, backgroundColor: '#ffffff' }} />
            <View style={{ position: 'absolute', width: size * 0.7, height: arm * 0.75, borderRadius: arm * 0.5, backgroundColor: '#ffffff', transform: [{ rotate: '45deg' }] }} />
            <View style={{ position: 'absolute', width: size * 0.7, height: arm * 0.75, borderRadius: arm * 0.5, backgroundColor: '#ffffff', transform: [{ rotate: '-45deg' }] }} />
            <View style={{ position: 'absolute', width: arm * 2, height: arm * 2, borderRadius: arm, backgroundColor: '#ffffff' }} />
          </View>
        );
      })}

      {/* Shooting stars — tapered contrail */}
      {shooters.map((s) => {
        const age = (time - s.born) / s.duration;
        if (age < 0 || age > 1) return null;
        const headT = Math.min(1, age * 2);
        const tailT = Math.max(0, age * 2 - 0.6);
        const fade = age < 0.3 ? age / 0.3 : 1 - (age - 0.3) / 0.7;
        const cosA = Math.cos(s.angle);
        const sinA = Math.sin(s.angle);
        const N = 18;
        const dots = Array.from({ length: N }, (_, i) => {
          const t = i / (N - 1); // 0 = head, 1 = tail
          const frac = headT - t * (headT - tailT);
          const px = s.x * 100 + cosA * s.length * frac;
          const py = s.y * 100 + sinA * s.length * frac;
          const dotSize = Math.max(0.5, (1 - t) * 3.5 + 0.5);
          const opacity = fade * Math.pow(1 - t, 1.4) * 0.75;
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: `${px}%`,
                top: `${py}%`,
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize,
                backgroundColor: '#ffffff',
                opacity,
                marginLeft: -dotSize / 2,
                marginTop: -dotSize / 2,
              }}
            />
          );
        });
        return <Fragment key={s.id}>{dots}</Fragment>;
      })}
    </View>
  );
}

function Avatar({
  name,
  pending,
  large = false,
}: {
  name: string;
  pending: boolean;
  large?: boolean;
}) {
  return (
    <View
      style={[
        styles.avatar,
        large && styles.profileAvatar,
        pending ? styles.avatarPending : styles.avatarDefault,
      ]}
    >
      <Text
        style={[
          styles.avatarText,
          large && styles.profileAvatarText,
          pending ? styles.avatarTextPending : styles.avatarTextDefault,
        ]}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

function PersonRowView({
  person,
  active,
  onPress,
}: {
  person: PersonRecord;
  active: boolean;
  onPress: () => void;
}) {
  const pending = hasFollowUp(person);

  return (
    <Pressable onPress={onPress} style={[styles.row, active && styles.rowActive]}>
      <Avatar name={person.name} pending={pending} />
      <View style={styles.rowContent}>
        <Text numberOfLines={1} style={styles.personName}>
          {person.name}
        </Text>
        <Text numberOfLines={1} style={styles.personSubtitle}>
          {[person.role, person.company, person.city].filter(Boolean).join(' \u00B7 ') || ' '}
        </Text>
      </View>
      {pending ? (
        <View style={styles.followUpBadge}>
          <View style={styles.followUpDot} />
        </View>
      ) : null}
      <Text style={styles.rowDate}>{formatDate(person.updated_at, true)}</Text>
    </Pressable>
  );
}

function FactGrid({ cells }: { cells: string[][] }) {
  return (
    <View style={styles.factGrid}>
      {cells.map(([label, value]) => (
        <View key={label} style={styles.factCell}>
          <Text style={styles.factLabel}>{label}</Text>
          <Text style={styles.factValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor="#3a3a44"
        style={[styles.input, multiline && styles.inputMultiline]}
        textAlignVertical={multiline ? 'top' : 'center'}
        value={value}
      />
    </View>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
}) {
  const [show, setShow] = useState(false);
  const dateValue = value ? new Date(value) : new Date();

  const handleChange = (_: unknown, selected?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (selected) onChange(selected.toISOString().split('T')[0]);
  };

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable onPress={() => setShow(true)} style={styles.dateButton}>
        <Text style={[styles.dateButtonText, !value && styles.dateButtonPlaceholder]}>
          {value ? formatDate(value) : 'Select date'}
        </Text>
        {value ? (
          <Pressable onPress={() => onChange('')} hitSlop={8}>
            <Text style={styles.dateClear}>×</Text>
          </Pressable>
        ) : null}
      </Pressable>

      {show && Platform.OS === 'android' && (
        <DateTimePicker value={dateValue} mode="date" display="calendar" onChange={handleChange} />
      )}

      {show && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide" onRequestClose={() => setShow(false)}>
          <Pressable style={styles.dateModalBackdrop} onPress={() => setShow(false)} />
          <View style={styles.dateSheet}>
            <View style={styles.dateSheetToolbar}>
              <Pressable onPress={() => { onChange(''); setShow(false); }}>
                <Text style={styles.dateSheetClear}>Clear</Text>
              </Pressable>
              <Pressable onPress={() => setShow(false)}>
                <Text style={styles.dateSheetDone}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={dateValue}
              mode="date"
              display="spinner"
              onChange={handleChange}
              themeVariant="dark"
              style={{ backgroundColor: '#0e0e12' }}
            />
          </View>
        </Modal>
      )}
    </View>
  );
}

function TagMultiSelect({
  availableTags,
  label,
  onChange,
  onCreateTag,
  selectedTags,
}: {
  availableTags: TagOption[];
  label: string;
  onChange: (tags: string[]) => void;
  onCreateTag: (label: string, color?: string) => Promise<string | null>;
  selectedTags: string[];
}) {
  const [open, setOpen] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [newTagColor, setNewTagColor] = useState<string>(DEFAULT_TAG_COLOR);

  const toggleTag = (tag: string) => {
    onChange(
      selectedTags.includes(tag)
        ? selectedTags.filter((value) => value !== tag)
        : [...selectedTags, tag]
    );
  };

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable onPress={() => setOpen((current) => !current)} style={styles.tagDropdownTrigger}>
        <View style={styles.tagChipWrap}>
          {selectedTags.length > 0 ? (
            selectedTags.map((tag) => (
              <View
                key={tag}
                style={[
                  styles.selectedTagChip,
                  { backgroundColor: hexToRgba(availableTags.find((item) => item.label === tag)?.color ?? DEFAULT_TAG_COLOR, 0.18) },
                ]}
              >
                <Text style={styles.selectedTagText}>{tag}</Text>
                <Pressable onPress={() => onChange(selectedTags.filter((value) => value !== tag))} hitSlop={8}>
                  <Text style={styles.selectedTagRemove}>x</Text>
                </Pressable>
              </View>
            ))
          ) : (
            <Text style={styles.tagPlaceholder}>Select tags</Text>
          )}
        </View>
      </Pressable>

      {open ? (
        <View style={styles.tagDropdown}>
          <ScrollView nestedScrollEnabled style={styles.tagDropdownList}>
            {availableTags.map((tag) => {
              const active = selectedTags.includes(tag.label);
              return (
                <Pressable key={tag.id} onPress={() => toggleTag(tag.label)} style={styles.tagDropdownItem}>
                  <View style={styles.tagDropdownMeta}>
                    <View style={[styles.tagColorDot, { backgroundColor: tag.color }]} />
                    <Text style={[styles.tagDropdownText, active && styles.tagDropdownTextActive]}>
                      {tag.label}
                    </Text>
                  </View>
                  {active ? <Text style={styles.tagDropdownCheck}>✓</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.tagCreateRow}>
            <TextInput
              onChangeText={setNewTag}
              placeholder="Create new tag"
              placeholderTextColor="#3a3a44"
              style={[styles.input, styles.tagCreateInput]}
              value={newTag}
            />
            <Pressable
              onPress={async () => {
                const clean = newTag.trim();
                if (!clean) {
                  return;
                }
                await onCreateTag(clean, newTagColor);
                setNewTag('');
                setNewTagColor(DEFAULT_TAG_COLOR);
              }}
              style={styles.ghostButton}
            >
              <Text style={styles.ghostButtonText}>Create</Text>
            </Pressable>
          </View>
          <ColorPicker label="New tag color" selectedColor={newTagColor} onChange={setNewTagColor} />
        </View>
      ) : null}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.filterChip, active ? styles.filterChipActive : styles.filterChipIdle]}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function TagChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tagChip, active ? styles.tagChipActive : styles.tagChipIdle]}>
      <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function TagPill({ color, label }: { color?: string | null; label: string }) {
  const resolvedColor = normalizeTagColor(color);
  return (
    <View style={[styles.tagPill, { backgroundColor: hexToRgba(resolvedColor, 0.14), borderColor: hexToRgba(resolvedColor, 0.34) }]}>
      <View style={[styles.tagPillDot, { backgroundColor: resolvedColor }]} />
      <Text style={[styles.tagPillText, { color: resolvedColor }]}>{label}</Text>
    </View>
  );
}

function ColorPicker({
  label,
  onChange,
  selectedColor,
}: {
  label: string;
  onChange: (value: string) => void;
  selectedColor: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.colorPickerRow}>
        {TAG_COLORS.map((color) => {
          const active = color === selectedColor;
          return (
            <Pressable
              key={color}
              onPress={() => onChange(color)}
              style={[
                styles.colorSwatch,
                { backgroundColor: color, borderColor: active ? '#e8e8f0' : 'rgba(255,255,255,0.08)' },
              ]}
            >
              {active ? <Text style={styles.colorSwatchCheck}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function NoteTypePill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.noteTypePill, !active && styles.noteTypePillMuted]}>
      <Text style={[styles.noteTypePillText, !active && styles.noteTypePillTextMuted]}>{label}</Text>
    </Pressable>
  );
}

function PeopleIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 22, height: 20, alignItems: 'center' }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: color, marginBottom: 1 }} />
      <View style={{ width: 14, height: 6, borderTopLeftRadius: 7, borderTopRightRadius: 7, borderWidth: 1.5, borderBottomWidth: 0, borderColor: color }} />
    </View>
  );
}

function NotesIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 16, height: 20, borderRadius: 3, borderWidth: 1.5, borderColor: color, justifyContent: 'center', paddingHorizontal: 3, gap: 3 }}>
      <View style={{ height: 0, borderTopWidth: 1.5, borderColor: color, width: '100%' }} />
      <View style={{ height: 0, borderTopWidth: 1.5, borderColor: color, width: '60%' }} />
    </View>
  );
}

function TagsIcon({ color }: { color: string }) {
  return (
    <Text style={{ color, fontSize: 18, fontWeight: '600' }}>#</Text>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080809',
  },
  flex: {
    flex: 1,
  },
  starfield: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pageTitle: {
    color: '#e8e8f0',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  toolbar: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
  },
  searchShell: {
    backgroundColor: '#0e0e12',
    borderRadius: 6,
    marginBottom: 8,
  },
  searchInput: {
    color: '#e8e8f0',
    fontSize: 14,
    fontWeight: '400',
    minHeight: 36,
    paddingHorizontal: 12,
  },
  filterRow: {
    gap: 4,
  },
  filterChip: {
    borderRadius: 6,
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  filterChipIdle: {
    backgroundColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: '#141418',
  },
  filterChipText: {
    color: '#4a4a56',
    fontSize: 13,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#e8e8f0',
  },
  content: {
    flex: 1,
  },
  contentDesktop: {
    flexDirection: 'row',
  },
  detailHeader: {
    alignItems: 'center',
    borderBottomColor: '#1a1a20',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButton: {
    paddingVertical: 4,
  },
  backButtonText: {
    color: '#7c6cf0',
    fontSize: 16,
    fontWeight: '500',
  },
  listPane: {
    flex: 1,
    borderBottomColor: '#1a1a20',
    borderBottomWidth: 1,
  },
  listPaneDesktop: {
    borderBottomWidth: 0,
    borderRightColor: '#1a1a20',
    borderRightWidth: 1,
    flexBasis: '46%',
  },
  detailPane: {
    flex: 1,
  },
  detailPaneDesktop: {
    flexBasis: '54%',
  },
  sectionHeader: {
    alignItems: 'center',
    borderBottomColor: '#1a1a20',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  sectionLabel: {
    color: '#5a5a66',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  ghostButton: {
    alignItems: 'center',
    backgroundColor: '#0e0e12',
    borderRadius: 4,
    justifyContent: 'center',
    minHeight: 28,
    paddingHorizontal: 10,
  },
  ghostButtonText: {
    color: '#a0a0b0',
    fontSize: 13,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dangerButton: {
    alignItems: 'center',
    backgroundColor: '#181015',
    borderRadius: 4,
    justifyContent: 'center',
    minHeight: 28,
    paddingHorizontal: 10,
  },
  dangerButtonText: {
    color: '#d08aa2',
    fontSize: 13,
    fontWeight: '500',
  },
  formSection: {
    borderBottomColor: '#1a1a20',
    borderBottomWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  formPairRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 0,
  },
  formPairCell: {
    flex: 1,
  },
  moreToggle: {
    paddingVertical: 10,
  },
  moreToggleText: {
    color: '#7c6cf0',
    fontSize: 13,
    fontWeight: '500',
  },
  formSaveButton: {
    marginTop: 12,
  },
  formHeading: {
    color: '#e8e8f0',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  formGrid: {
    gap: 4,
  },
  field: {
    marginBottom: 8,
  },
  fieldLabel: {
    color: '#5a5a66',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#0e0e12',
    borderRadius: 4,
    color: '#a0a0b0',
    fontSize: 14,
    fontWeight: '400',
    minHeight: 36,
    paddingHorizontal: 10,
  },
  inputMultiline: {
    minHeight: 80,
    paddingTop: 10,
    paddingBottom: 10,
  },
  tagDropdownTrigger: {
    backgroundColor: '#0e0e12',
    borderRadius: 4,
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tagChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedTagChip: {
    alignItems: 'center',
    backgroundColor: '#18181d',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectedTagText: {
    color: '#c0c0d0',
    fontSize: 12,
    fontWeight: '400',
  },
  selectedTagRemove: {
    color: '#8a8a98',
    fontSize: 12,
    fontWeight: '500',
  },
  tagPlaceholder: {
    color: '#5a5a66',
    fontSize: 14,
    fontWeight: '400',
  },
  tagDropdown: {
    backgroundColor: '#0e0e12',
    borderColor: '#1a1a20',
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 8,
    overflow: 'hidden',
  },
  tagDropdownList: {
    maxHeight: 180,
  },
  tagDropdownItem: {
    alignItems: 'center',
    borderBottomColor: '#1a1a20',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tagDropdownMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  tagColorDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  tagDropdownText: {
    color: '#a0a0b0',
    fontSize: 13,
    fontWeight: '400',
  },
  tagDropdownTextActive: {
    color: '#e8e8f0',
  },
  tagDropdownCheck: {
    color: '#e8e8f0',
    fontSize: 13,
    fontWeight: '500',
  },
  tagCreateRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    padding: 10,
  },
  tagCreateInput: {
    flex: 1,
    minHeight: 36,
  },
  dateButton: {
    alignItems: 'center',
    backgroundColor: '#0e0e12',
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 36,
    paddingHorizontal: 10,
  },
  dateButtonText: {
    color: '#a0a0b0',
    fontSize: 14,
    fontWeight: '400',
  },
  dateButtonPlaceholder: {
    color: '#3a3a44',
  },
  dateClear: {
    color: '#5a5a66',
    fontSize: 18,
    lineHeight: 20,
    paddingLeft: 8,
  },
  dateModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  dateSheet: {
    backgroundColor: '#0e0e12',
    borderTopColor: '#1a1a20',
    borderTopWidth: 1,
    paddingBottom: 32,
  },
  dateSheetToolbar: {
    alignItems: 'center',
    borderBottomColor: '#1a1a20',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  dateSheetClear: {
    color: '#d08aa2',
    fontSize: 15,
    fontWeight: '500',
  },
  dateSheetDone: {
    color: '#7c6cf0',
    fontSize: 15,
    fontWeight: '600',
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  tagChip: {
    borderRadius: 4,
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  tagChipIdle: {
    backgroundColor: '#0e0e12',
  },
  tagChipActive: {
    backgroundColor: '#6a58cc',
  },
  tagChipText: {
    color: '#5a5a66',
    fontSize: 13,
    fontWeight: '400',
  },
  tagChipTextActive: {
    color: '#ffffff',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#6a58cc',
    borderRadius: 4,
    justifyContent: 'center',
    minHeight: 32,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
  },
  rowContent: {
    flex: 1,
  },
  row: {
    alignItems: 'center',
    borderBottomColor: '#1a1a20',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  rowActive: {
    backgroundColor: '#0e0e12',
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    marginRight: 12,
    width: 32,
  },
  profileAvatar: {
    borderRadius: 22,
    height: 44,
    marginRight: 14,
    width: 44,
  },
  avatarDefault: {
    backgroundColor: '#141418',
  },
  avatarPending: {
    backgroundColor: '#1a1530',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '500',
  },
  profileAvatarText: {
    fontSize: 15,
  },
  avatarTextDefault: {
    color: '#7a7a8a',
  },
  avatarTextPending: {
    color: '#8b7cf0',
  },
  personName: {
    color: '#c0c0d0',
    fontSize: 14,
    fontWeight: '500',
  },
  personSubtitle: {
    color: '#4a4a56',
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  rowDate: {
    color: '#3a3a44',
    fontSize: 12,
    fontWeight: '400',
    marginLeft: 8,
  },
  followUpBadge: {
    marginLeft: 8,
  },
  followUpDot: {
    backgroundColor: '#7c6cf0',
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  profileSection: {
    borderBottomColor: '#1a1a20',
    borderBottomWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  profileTop: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 16,
  },
  profileMeta: {
    flex: 1,
  },
  profileName: {
    color: '#e8e8f0',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  profileSubline: {
    color: '#5a5a66',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 2,
  },
  factGrid: {
    borderColor: '#1a1a20',
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
  },
  factCell: {
    borderBottomColor: '#1a1a20',
    borderBottomWidth: 1,
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: '50%',
  },
  factLabel: {
    color: '#4a4a56',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  factValue: {
    color: '#a0a0b0',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 20,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  tagPill: {
    alignItems: 'center',
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagPillDot: {
    borderRadius: 4,
    height: 6,
    width: 6,
  },
  tagPillText: {
    fontSize: 12,
    fontWeight: '400',
  },
  ghostText: {
    color: '#3a3a44',
    fontSize: 13,
    fontWeight: '400',
  },
  noteComposerSection: {
    borderBottomColor: '#1a1a20',
    borderBottomWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  noteTypePill: {
    backgroundColor: 'rgba(106,88,204,0.12)',
    borderRadius: 4,
    justifyContent: 'center',
    minHeight: 26,
    paddingHorizontal: 8,
  },
  noteTypePillMuted: {
    backgroundColor: '#0e0e12',
  },
  noteTypePillText: {
    color: '#8b7cf0',
    fontSize: 12,
    fontWeight: '500',
  },
  noteTypePillTextMuted: {
    color: '#4a4a56',
  },
  notesSection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  subsectionBlock: {
    marginTop: 16,
  },
  colorPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorSwatch: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  colorSwatchCheck: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  noteListRow: {
    borderBottomColor: '#1a1a20',
    borderBottomWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  noteCard: {
    borderBottomColor: '#1a1a20',
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  noteCardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  noteActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  noteDate: {
    color: '#3a3a44',
    fontSize: 12,
    fontWeight: '400',
  },
  noteBody: {
    color: '#a0a0b0',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 22,
  },
  inlineMuted: {
    color: '#5a5a66',
    fontSize: 11,
    fontWeight: '400',
    marginTop: 8,
    textTransform: 'uppercase',
  },
  inlineAction: {
    paddingVertical: 4,
  },
  inlineActionText: {
    color: '#a0a0b0',
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  inlineDangerText: {
    color: '#d08aa2',
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  linkSection: {
    borderTopColor: '#1a1a20',
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  tagListRow: {
    alignItems: 'center',
    borderBottomColor: '#1a1a20',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  tagLinkedRow: {
    alignItems: 'center',
    borderBottomColor: '#1a1a20',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingVertical: 12,
  },
  emptyAddPrompt: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: 16,
  },
  emptyAddCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#2a2a34',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyAddPlus: {
    color: '#4a4a56',
    fontSize: 26,
    fontWeight: '300',
    lineHeight: 30,
  },
  emptyAddLabel: {
    color: '#3a3a44',
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: '#e8e8f0',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyBody: {
    color: '#5a5a66',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 4,
    textAlign: 'center',
  },
  bottomNav: {
    backgroundColor: '#080809',
    borderTopColor: '#1a1a20',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    paddingBottom: 16,
  },
  navItem: {
    alignItems: 'center',
    gap: 4,
  },
  navLabel: {
    color: '#a0a0b0',
    fontSize: 10,
    fontWeight: '400',
    opacity: 0.35,
    textTransform: 'uppercase',
  },
  navActive: {
    opacity: 1,
  },
});
