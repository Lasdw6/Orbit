import { randomUUID } from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

const RELATIONSHIPS = ['close', 'acquaintance', 'just met'] as const;
const NOTE_TYPES = ['free', 'coffee', 'call', 'message', 'event', 'intro'] as const;
const FILTERS = ['all', 'follow up', 'close'] as const;

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
  met_at: string | null;
  met_date: string | null;
  relationship: Relationship | null;
  photo_uri: string | null;
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
  created_at: string;
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
  metAt: string;
  metDate: string;
  relationship: Relationship;
  followUpDate: string;
  tags: string;
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
  metAt: '',
  metDate: '',
  relationship: 'acquaintance',
  followUpDate: '',
  tags: '',
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
          met_at TEXT,
          met_date TEXT,
          relationship TEXT CHECK(relationship IN ('close','acquaintance','just met')),
          photo_uri TEXT,
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
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS person_tag (
          person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
          tag_id TEXT NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
          PRIMARY KEY (person_id, tag_id)
        );
      `);
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
      `SELECT person_tag.person_id, tag.id, tag.label, tag.created_at
       FROM person_tag JOIN tag ON tag.id = person_tag.tag_id
       ORDER BY tag.label ASC`
    ),
  ]);

  return buildPeople(peopleRows, noteRows, tagRows);
}

async function insertPerson(draft: PersonDraft) {
  const db = await getDatabase();
  const personId = randomUUID();
  const now = nowIso();
  const labels = draft.tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO person (
        id, name, summary, company, role, city, school, met_at, met_date,
        relationship, photo_uri, follow_up_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      personId,
      draft.name.trim(),
      cleanValue(draft.summary),
      cleanValue(draft.company),
      cleanValue(draft.role),
      cleanValue(draft.city),
      cleanValue(draft.school),
      cleanValue(draft.metAt),
      cleanValue(draft.metDate),
      draft.relationship,
      null,
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
          `INSERT INTO tag (id, label, created_at) VALUES (?, ?, ?)`,
          tagId,
          label,
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

async function syncPersonTags(tx: any, personId: string, rawTags: string, now: string) {
  const labels = Array.from(
    new Set(
      rawTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  );

  await tx.runAsync(`DELETE FROM person_tag WHERE person_id = ?`, personId);

  for (const label of labels) {
    const existing = (await tx.getFirstAsync(
      `SELECT id FROM tag WHERE lower(label) = lower(?) LIMIT 1`,
      label
    )) as { id: string } | null;
    const tagId = existing?.id ?? randomUUID();

    if (!existing) {
      await tx.runAsync(
        `INSERT INTO tag (id, label, created_at) VALUES (?, ?, ?)`,
        tagId,
        label,
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
       SET name = ?, summary = ?, company = ?, role = ?, city = ?, school = ?,
           met_at = ?, met_date = ?, relationship = ?, follow_up_date = ?, updated_at = ?
       WHERE id = ?`,
      draft.name.trim(),
      cleanValue(draft.summary),
      cleanValue(draft.company),
      cleanValue(draft.role),
      cleanValue(draft.city),
      cleanValue(draft.school),
      cleanValue(draft.metAt),
      cleanValue(draft.metDate),
      draft.relationship,
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

async function renameTag(tagId: string, label: string) {
  const db = await getDatabase();
  await db.runAsync(`UPDATE tag SET label = ? WHERE id = ?`, label.trim(), tagId);
}

async function deleteTag(tagId: string) {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM tag WHERE id = ?`, tagId);
}

export default function App() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 940;
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [activeSection, setActiveSection] = useState<SectionType>('people');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [personDraft, setPersonDraft] = useState<PersonDraft>(emptyPersonDraft);
  const [noteDraft, setNoteDraft] = useState<NoteDraft>(emptyNoteDraft);
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const refresh = async (preferredId?: string | null) => {
    try {
      const nextPeople = await loadPeople();
      setPeople(nextPeople);
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
      { id: string; label: string; count: number; people: PersonRecord[] }
    >();

    people.forEach((person) => {
      person.tags.forEach((tag) => {
        const current = grouped.get(tag.id) ?? {
          id: tag.id,
          label: tag.label,
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
  }, [people]);

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
  }, [selectedTag?.id]);

  const factCells = selectedPerson
    ? [
        ['Company', selectedPerson.company ?? '-'],
        ['Role', selectedPerson.role ?? '-'],
        ['City', selectedPerson.city ?? '-'],
        ['School', selectedPerson.school ?? '-'],
        ['Met at', selectedPerson.met_at ?? '-'],
        ['Met date', formatDate(selectedPerson.met_date)],
        ['Relationship', selectedPerson.relationship ?? '-'],
        ['Follow up', formatDate(selectedPerson.follow_up_date)],
      ]
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

  const startEditPerson = (person: PersonRecord) => {
    setEditingPersonId(person.id);
    setPersonDraft({
      name: person.name,
      summary: person.summary ?? '',
      company: person.company ?? '',
      role: person.role ?? '',
      city: person.city ?? '',
      school: person.school ?? '',
      metAt: person.met_at ?? '',
      metDate: person.met_date ?? '',
      relationship: person.relationship ?? 'acquaintance',
      followUpDate: person.follow_up_date ?? '',
      tags: person.tags.map((tag) => tag.label).join(', '),
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
      await renameTag(selectedTag.id, tagDraft);
      await refresh(selectedPersonId);
    } catch {
      Alert.alert('Database error', 'Orbit could not rename this tag.');
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
                <Text style={styles.pageTitle}>
                  {activeSection === 'people'
                    ? 'People'
                    : activeSection === 'notes'
                      ? 'Notes'
                      : 'Tags'}
                </Text>
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
              editingNoteId={editingNoteId}
              editingPersonId={editingPersonId}
              factCells={factCells}
              filteredPeople={filteredPeople}
              isDesktop={isDesktop}
              mobileDetailOpen={mobileDetailOpen}
              noteDraft={noteDraft}
              onBack={goBack}
              personDraft={personDraft}
              removeNote={removeNote}
              removePerson={removePerson}
              saveNote={saveNote}
              savePerson={savePerson}
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
              onOpenPerson={(personId) => {
                selectPerson(personId);
                setActiveSection('people');
              }}
              onDeleteTag={removeTag}
              onSelectTag={selectTag}
              onTagDraftChange={setTagDraft}
              onTagSave={saveTag}
              selectedTag={selectedTag}
              selectedTagId={selectedTagId}
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

function PeopleSection({
  editingNoteId,
  editingPersonId,
  factCells,
  filteredPeople,
  isDesktop,
  mobileDetailOpen,
  noteDraft,
  onBack,
  personDraft,
  removeNote,
  removePerson,
  saveNote,
  savePerson,
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
  editingNoteId: string | null;
  editingPersonId: string | null;
  factCells: string[][];
  filteredPeople: PersonRecord[];
  isDesktop: boolean;
  mobileDetailOpen: boolean;
  noteDraft: NoteDraft;
  onBack: () => void;
  personDraft: PersonDraft;
  removeNote: (noteId: string, personId: string) => void;
  removePerson: (personId: string) => void;
  saveNote: () => void;
  savePerson: () => void;
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
            <FactGrid cells={factCells} />
            <View style={styles.tagRow}>
              {selectedPerson.tags.length > 0 ? selectedPerson.tags.map((tag) => <TagPill key={tag.id} label={tag.label} />) : <Text style={styles.ghostText}>No tags</Text>}
            </View>
          </View>

          {showPersonForm ? (
            <View style={styles.formSection}>
              <Text style={styles.formHeading}>{editingPersonId ? 'Edit person' : 'New person'}</Text>
              <View style={styles.formGrid}>
                <Field label="Name" value={personDraft.name} onChangeText={(value) => setPersonDraft((current) => ({ ...current, name: value }))} />
                <Field label="Company" value={personDraft.company} onChangeText={(value) => setPersonDraft((current) => ({ ...current, company: value }))} />
                <Field label="Role" value={personDraft.role} onChangeText={(value) => setPersonDraft((current) => ({ ...current, role: value }))} />
                <Field label="City" value={personDraft.city} onChangeText={(value) => setPersonDraft((current) => ({ ...current, city: value }))} />
                <Field label="School" value={personDraft.school} onChangeText={(value) => setPersonDraft((current) => ({ ...current, school: value }))} />
                <Field label="Met at" value={personDraft.metAt} onChangeText={(value) => setPersonDraft((current) => ({ ...current, metAt: value }))} />
                <Field label="Met date" value={personDraft.metDate} onChangeText={(value) => setPersonDraft((current) => ({ ...current, metDate: value }))} />
                <Field label="Follow up" value={personDraft.followUpDate} onChangeText={(value) => setPersonDraft((current) => ({ ...current, followUpDate: value }))} />
              </View>
              <Text style={styles.fieldLabel}>Relationship</Text>
              <View style={styles.typeRow}>
                {RELATIONSHIPS.map((relationship) => (
                  <TagChip key={relationship} label={relationship} active={personDraft.relationship === relationship} onPress={() => setPersonDraft((current) => ({ ...current, relationship }))} />
                ))}
              </View>
              <Field label="Tags" value={personDraft.tags} onChangeText={(value) => setPersonDraft((current) => ({ ...current, tags: value }))} />
              <Field label="Summary" multiline value={personDraft.summary} onChangeText={(value) => setPersonDraft((current) => ({ ...current, summary: value }))} />
              <Pressable onPress={savePerson} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>{editingPersonId ? 'Update person' : 'Save person'}</Text>
              </Pressable>
            </View>
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
            <View style={styles.formSection}>
              <Text style={styles.formHeading}>{editingPersonId ? 'Edit person' : 'New person'}</Text>
              <View style={styles.formGrid}>
                <Field label="Name" value={personDraft.name} onChangeText={(value) => setPersonDraft((current) => ({ ...current, name: value }))} />
                <Field label="Company" value={personDraft.company} onChangeText={(value) => setPersonDraft((current) => ({ ...current, company: value }))} />
                <Field label="Role" value={personDraft.role} onChangeText={(value) => setPersonDraft((current) => ({ ...current, role: value }))} />
                <Field label="City" value={personDraft.city} onChangeText={(value) => setPersonDraft((current) => ({ ...current, city: value }))} />
                <Field label="School" value={personDraft.school} onChangeText={(value) => setPersonDraft((current) => ({ ...current, school: value }))} />
                <Field label="Met at" value={personDraft.metAt} onChangeText={(value) => setPersonDraft((current) => ({ ...current, metAt: value }))} />
                <Field label="Met date" value={personDraft.metDate} onChangeText={(value) => setPersonDraft((current) => ({ ...current, metDate: value }))} />
                <Field label="Follow up" value={personDraft.followUpDate} onChangeText={(value) => setPersonDraft((current) => ({ ...current, followUpDate: value }))} />
              </View>
              <Text style={styles.fieldLabel}>Relationship</Text>
              <View style={styles.typeRow}>
                {RELATIONSHIPS.map((relationship) => (
                  <TagChip key={relationship} label={relationship} active={personDraft.relationship === relationship} onPress={() => setPersonDraft((current) => ({ ...current, relationship }))} />
                ))}
              </View>
              <Field label="Tags" value={personDraft.tags} onChangeText={(value) => setPersonDraft((current) => ({ ...current, tags: value }))} />
              <Field label="Summary" multiline value={personDraft.summary} onChangeText={(value) => setPersonDraft((current) => ({ ...current, summary: value }))} />
              <Pressable onPress={savePerson} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>{editingPersonId ? 'Update person' : 'Save person'}</Text>
              </Pressable>
            </View>
          ) : null}

          <ScrollView showsVerticalScrollIndicator={false}>
            {filteredPeople.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No results</Text>
                <Text style={styles.emptyBody}>Change the filter or add someone new.</Text>
              </View>
            ) : (
              filteredPeople.map((person) => (
                <PersonRowView key={person.id} active={person.id === selectedPersonId} person={person} onPress={() => selectPerson(person.id)} />
              ))
            )}
          </ScrollView>
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
  onDeleteTag,
  onOpenPerson,
  onSelectTag,
  onTagDraftChange,
  onTagSave,
  selectedTag,
  selectedTagId,
  tagDraft,
}: {
  filteredTags: Array<{ id: string; label: string; count: number; people: PersonRecord[] }>;
  isDesktop: boolean;
  mobileDetailOpen: boolean;
  onBack: () => void;
  onDeleteTag: (tagId: string) => void;
  onOpenPerson: (personId: string) => void;
  onSelectTag: (tagId: string) => void;
  onTagDraftChange: (value: string) => void;
  onTagSave: () => void;
  selectedTag: { id: string; label: string; count: number; people: PersonRecord[] } | null;
  selectedTagId: string | null;
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
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {filteredTags.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No tags</Text>
                <Text style={styles.emptyBody}>Add tags when you create people.</Text>
              </View>
            ) : (
              filteredTags.map((tag) => (
                <Pressable key={tag.id} onPress={() => onSelectTag(tag.id)} style={[styles.tagListRow, tag.id === selectedTagId && styles.rowActive]}>
                  <TagPill label={tag.label} />
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

type StarData = {
  id: string;
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
  const stars = useMemo<StarData[]>(() => {
    const makeStar = (index: number, bright: boolean): StarData => ({
      id: `${bright ? 'b' : 'f'}-${index}`,
      idx: index,
      size: bright ? 6 + Math.random() * 4 : 3 + Math.random() * 3,
      base: bright ? 0.1 + Math.random() * 0.1 : 0.04 + Math.random() * 0.06,
      speed: 0.001 + Math.random() * 0.002,
      offset: index * 2.3,
      lifeSpeed: 0.00012 + Math.random() * 0.00025,
      lifeOffset: Math.random() * Math.PI * 2,
    });

    return [
      ...Array.from({ length: 60 }, (_, i) => makeStar(i, false)),
      ...Array.from({ length: 8 }, (_, i) => makeStar(i + 60, true)),
    ];
  }, []);

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

  return { stars, time, shooters };
}

function Starfield() {
  const { stars, time, shooters } = useStarfield();

  return (
    <View pointerEvents="none" style={styles.starfield}>
      {stars.map((star) => {
        const arm = Math.max(1, star.size * 0.2);
        const flicker = star.base * (0.6 + 0.4 * Math.sin(time * star.speed + star.offset));
        const phase = time * star.lifeSpeed + star.lifeOffset;
        const life = 0.5 + 0.5 * Math.sin(phase);
        const alive = life > 0.2;
        const fadeIn = Math.min(1, (life - 0.2) / 0.15);
        const opacity = alive ? flicker * fadeIn : 0;
        const cycle = Math.floor(phase / Math.PI);
        const seed = cycle * 127 + star.idx * 311;
        const x = ((seed * 16807 + 7) % 2147483647) / 2147483647;
        const y = ((seed * 48271 + 11) % 2147483647) / 2147483647;

        return (
          <View
            key={star.id}
            style={{
              position: 'absolute',
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              width: star.size,
              height: star.size,
              alignItems: 'center',
              justifyContent: 'center',
              opacity,
            }}
          >
            <View style={{ position: 'absolute', width: star.size, height: arm, borderRadius: arm * 0.4, backgroundColor: '#ffffff' }} />
            <View style={{ position: 'absolute', width: arm, height: star.size, borderRadius: arm * 0.4, backgroundColor: '#ffffff' }} />
          </View>
        );
      })}
      {shooters.map((s) => {
        const age = (time - s.born) / s.duration;
        if (age < 0 || age > 1) return null;
        const headT = Math.min(1, age * 2);
        const tailT = Math.max(0, age * 2 - 0.6);
        const dx = Math.cos(s.angle) * s.length;
        const dy = Math.sin(s.angle) * s.length;
        const headX = s.x * 100 + dx * headT;
        const headY = s.y * 100 + dy * headT;
        const tailX = s.x * 100 + dx * tailT;
        const tailY = s.y * 100 + dy * tailT;
        const trailLen = Math.sqrt((headX - tailX) ** 2 + (headY - tailY) ** 2);
        const trailAngle = Math.atan2(headY - tailY, headX - tailX);
        const fade = age < 0.3 ? age / 0.3 : 1 - (age - 0.3) / 0.7;

        return (
          <View
            key={s.id}
            style={{
              position: 'absolute',
              left: `${tailX}%`,
              top: `${tailY}%`,
              width: trailLen * 3,
              height: 1.5,
              borderRadius: 1,
              backgroundColor: '#ffffff',
              opacity: fade * 0.3,
              transform: [{ rotate: `${trailAngle}rad` }],
              transformOrigin: 'left center',
            }}
          />
        );
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

function TagPill({ label }: { label: string }) {
  return (
    <View style={styles.tagPill}>
      <Text style={styles.tagPillText}>{label}</Text>
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
    backgroundColor: '#141418',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagPillText: {
    color: '#7a7a8a',
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
    paddingTop: 14,
    paddingBottom: 48,
  },
  navItem: {
    alignItems: 'center',
    gap: 6,
  },
  navLabel: {
    color: '#a0a0b0',
    fontSize: 11,
    fontWeight: '400',
    opacity: 0.35,
    textTransform: 'uppercase',
  },
  navActive: {
    opacity: 1,
  },
});
