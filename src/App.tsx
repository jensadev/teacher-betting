import { useState, useEffect, useRef, type FormEvent } from 'react';
import {
    Users,
    ChevronRight,
    Check,
    AlertCircle,
    Award,
    Home,
    Clock,
    Wrench,
    HelpCircle,
    Search,
    ChevronLeft,
    Lightbulb,
    FileText,
    Calendar,
    BookOpen,
    GraduationCap,
    Folder
} from 'lucide-react';
import logo from './assets/logoFile.png';

type Role = 'host' | 'player';
type SessionState = 'lobby' | 'betting' | 'result' | 'ended';

interface Teacher {
    id: string;
    name: string;
    odds: number;
}

interface Challenge {
    id: string;
    title: string;
    description: string;
    teachers: Teacher[];
}

interface TeamBet {
    teacherId: string;
    amount: number;
}

interface Team {
    id: string;
    name: string;
    balance: number;
    activeBet: TeamBet | null;
}

interface StoredTeamIdentity {
    lobbyId: string;
    teamName: string;
    balance: number;
    activeBet: TeamBet | null;
}

interface WinningHistoryEntry {
    challengeId: string;
    winningTeacherId: string;
    winningTeacherName: string;
}

interface SessionData {
    id: string;
    currentSlideIndex: number;
    state: SessionState;
    winningHistory: WinningHistoryEntry[];
    lastWinner: Teacher | null;
}

interface PresencePayload {
    id: string;
    teamName?: string;
    balance?: number;
    activeBet?: TeamBet | null;
    updatedAt?: number;
}

interface RealtimeChannelLike {
    on(eventType: 'presence', filter: { event: 'sync' }, callback: () => void): RealtimeChannelLike;
    on(eventType: 'broadcast', filter: { event: string }, callback: (event: { payload: any }) => void): RealtimeChannelLike;
    subscribe(callback: (status: string) => void): RealtimeChannelLike;
    presenceState(): Record<string, PresencePayload[]>;
    track(payload: PresencePayload): Promise<unknown>;
    send(payload: { type: 'broadcast'; event: string; payload: unknown }): void;
    unsubscribe(): void;
}

interface SupabaseClientLike {
    channel(name: string, opts?: unknown): RealtimeChannelLike;
}

declare global {
    interface Window {
        supabase?: {
            createClient: (url: string, key: string) => SupabaseClientLike;
        };
    }
}

// ==========================================
// KONFIGURERING AV UTMANINGAR & LÄRARE
// ==========================================
const CHALLENGES: Challenge[] = [
    {
        id: "ch1",
        title: "Pappersflygplanet",
        description: "Några lärare med förkärlek för papercuts ska vika och sedan kasta ett pappersflygplan så långt som möjligt.",
        teachers: [
            { id: "t1", name: "Per (Matte)", odds: 2.6 },
            { id: "t2", name: "Fredrik (Religion)", odds: 6.5 },
            { id: "t3", name: "Henrik (Goblin)", odds: 4.33 },
            { id: "t4", name: "Sara (DNF)", odds: 4.33 }
        ]
    },
    {
        id: "ch2",
        title: "Kortslutningen",
        description: "De stackars lärarna som valts för detta ska recitera så många ord som möjligt på en viss bokstav under 30 sekunder.",
        teachers: [
            { id: "t1", name: "Sara (Rektor)", odds: 3.0 },
            { id: "t2", name: "Robert (Matte)", odds: 3.75 },
            { id: "t3", name: "Eszter (Litteratur)", odds: 3 },
            { id: "t4", name: "Jimmy (Psykologi)", odds: 15 }
        ]
    },
    {
        id: "ch3",
        title: "Kex-ansiktet",
        description: "Några få förtappade stackars lärare ska placera ett Mariekex på pannan. Lärarna ska flytta kexet till munnen utan att använda händerna.",
        teachers: [
            { id: "t1", name: "Frej (Artsyfartsy)", odds: 8 },
            { id: "t2", name: "Mattias (Nätverk)", odds: 8 },
            { id: "t3", name: "Fredrik (Religion)", odds: 2.67 },
            { id: "t4", name: "Lena (Kurator)", odds: 2.67 }
        ]
    },
    {
        id: "ch4",
        title: "Sifferminnet",
        description: "Några oändligt olyckliga lärare ska nu memorera flest decimaler av Pi på 30 sekunder.",
        teachers: [
            { id: "t1", name: "Norman (Kemi)", odds: 3.25 },
            { id: "t2", name: "Jens (Programmering)", odds: 4.33 },
            { id: "t3", name: "Rafael (Matematik)", odds: 3.25 },
            { id: "t4", name: "Henrik (Goblin)", odds: 6.5 }
        ]
    },
    {
        id: "ch5",
        title: "Pennan i flaskan",
        description: "Med en penna hängande från ett snöre runt midjan ska den stackars läraren försöka få ner pennan i en flaska på marken utan att använda händerna.",
        teachers: [
            { id: "t1", name: "Fredrik (Religion)", odds: 3.75 },
            { id: "t2", name: "Eszter (Litteratur)", odds: 7.5 },
            { id: "t3", name: "Jimmy (Psykologi)", odds: 3 },
            { id: "t4", name: "Daniel (Engelska)", odds: 3.75 }
        ]
    },
    {
        id: "ch6",
        title: "Emoji rebus",
        description: "De förtappade få kommer att få se 5 stycken rebusar med emojis, utifrån dessa ska de gissa filmen eller musiken som rebusen representerar.",
        teachers: [
            { id: "t1", name: "Lena (Kurator)", odds: 4.33 },
            { id: "t2", name: "Mattias (Nätverk)", odds: 3.25 },
            { id: "t3", name: "Rafael (Matematik)", odds: 4.33 },
            { id: "t4", name: "Frej (Artsyfartsy)", odds: 4.33 }
        ]
    },
    {
        id: "ch7",
        title: "Engelska ord",
        description: "De olyckligt utvalda ska stava engelska ord.",
        teachers: [
            { id: "t1", name: "Daniel (Engelska)", odds: 3 },
            { id: "t2", name: "Sara (DNF)", odds: 3 },
            { id: "t3", name: "Jimmy (Psykologi)", odds: 15 },
            { id: "t4", name: "Robert (Matte)", odds: 3.75 }
        ]
    },
    {
        id: "ch8",
        title: "Sockerbitstornet",
        description: "Ack och ve, de utvalda ska placera sockerbitar på varandra och bygga det högsta tornet på 60 sekunder. Tornet byggs på en pinne!",
        teachers: [
            { id: "t1", name: "Per (Matte)", odds: 4 },
            { id: "t2", name: "Eszter (Litteratur)", odds: 12 },
            { id: "t3", name: "Norman (Kemi)", odds: 2.4 },
            { id: "t4", name: "Jens (Programmering)", odds: 4 }
        ]
    },
];

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const TEAM_IDENTITY_STORAGE_KEY = 'betit_team_identity';

export default function App() {
    const [supabase, setSupabase] = useState<SupabaseClientLike | null>(null);
    const [supabaseReady, setSupabaseReady] = useState(false);

    const [role, setRole] = useState<Role | null>(null);
    const [lobbyId, setLobbyId] = useState('');
    const [playerId, setPlayerId] = useState('');

    const [session, setSession] = useState<SessionData | null>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [myTeam, setMyTeam] = useState<Team | null>(null);

    const [errorMessage, setErrorMessage] = useState('');
    const [newTeamName, setNewTeamName] = useState('');
    const [customBaseUrl, setCustomBaseUrl] = useState('');
    const [showUrlSettings, setShowUrlSettings] = useState(false);

    const [selectedTeacherId, setSelectedTeacherId] = useState('');
    const [betAmount, setBetAmount] = useState('');
    const [betSuccessMsg, setBetSuccessMsg] = useState('');

    const channelRef = useRef<RealtimeChannelLike | null>(null);

    const normalizeTeamName = (name: string) => name.trim().toLowerCase();

    const loadStoredTeamIdentity = (currentLobbyId: string): StoredTeamIdentity | null => {
        if (!currentLobbyId) return null;
        try {
            const raw = localStorage.getItem(TEAM_IDENTITY_STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as Partial<StoredTeamIdentity>;
            if (parsed.lobbyId !== currentLobbyId || typeof parsed.teamName !== 'string' || !parsed.teamName.trim()) {
                return null;
            }
            return {
                lobbyId: parsed.lobbyId,
                teamName: parsed.teamName.trim(),
                balance: typeof parsed.balance === 'number' ? parsed.balance : 100,
                activeBet: parsed.activeBet ?? null,
            };
        } catch {
            return null;
        }
    };

    const persistTeamIdentity = (team: Team, currentLobbyId: string) => {
        if (!currentLobbyId || !team.name.trim()) return;
        const identity: StoredTeamIdentity = {
            lobbyId: currentLobbyId,
            teamName: team.name,
            balance: team.balance,
            activeBet: team.activeBet,
        };
        localStorage.setItem(TEAM_IDENTITY_STORAGE_KEY, JSON.stringify(identity));
    };

    useEffect(() => {
        if (window.supabase) {
            setSupabaseReady(true);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.async = true;
        script.onload = () => setSupabaseReady(true);
        script.onerror = () => setErrorMessage("Kunde inte ladda ner Supabase Realtime-biblioteket från CDN.");
        document.body.appendChild(script);
        return () => {
            if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
        };
    }, []);

    useEffect(() => {
        if (supabaseReady && window.supabase) {
            if (!supabaseUrl || !supabaseKey) {
                setErrorMessage("Supabase-miljövariabler saknas! Kontrollera .env-fil.");
                return;
            }
            try {
                const client = window.supabase.createClient(supabaseUrl.trim(), supabaseKey.trim());
                setSupabase(client);
                setErrorMessage('');
            } catch (err) {
                setErrorMessage("Kunde inte initiera Supabase. Kontrollera miljövariabler.");
            }
        }
    }, [supabaseReady]);

    useEffect(() => {
        let pId = sessionStorage.getItem('betit_player_id');
        if (!pId) {
            pId = 'p-' + Math.random().toString(36).substring(2, 9);
            sessionStorage.setItem('betit_player_id', pId);
        }
        setPlayerId(pId);
        setCustomBaseUrl(window.location.origin + window.location.pathname);
    }, []);

    useEffect(() => {
        if (!supabase || !lobbyId) return;

        const channel = supabase.channel(`menti-${lobbyId}`, {
            config: { presence: { key: playerId || 'host' } },
        });

        channelRef.current = channel;

        channel
            .on('presence', { event: 'sync' }, () => {
                const presenceState = channel.presenceState();
                const teamMap = new Map<string, Team & { updatedAt: number }>();

                Object.keys(presenceState).forEach((key) => {
                    const userPresences = presenceState[key];
                    userPresences.forEach((p) => {
                        if (p.teamName) {
                            const incomingUpdatedAt = p.updatedAt ?? 0;
                            const existing = teamMap.get(p.id);

                            if (!existing || incomingUpdatedAt >= existing.updatedAt) {
                                teamMap.set(p.id, {
                                    id: p.id,
                                    name: p.teamName,
                                    balance: p.balance ?? 100,
                                    activeBet: p.activeBet ?? null,
                                    updatedAt: incomingUpdatedAt
                                });
                            }
                        }
                    });
                });

                const activeTeams: Team[] = Array.from(teamMap.values()).map(({ updatedAt: _updatedAt, ...team }) => team);
                activeTeams.sort((a, b) => b.balance - a.balance);
                setTeams(activeTeams);

                const me = activeTeams.find(t => t.id === playerId);
                if (me) setMyTeam(me);
            })
            .on('broadcast', { event: 'slide_change' }, ({ payload }) => {
                const nextSession = payload.session as SessionData;
                setSession(nextSession);
                setSelectedTeacherId('');
                setBetAmount('');
            })
            .on('broadcast', { event: 'round_resolved' }, ({ payload }) => {
                const nextSession = payload.session as SessionData;
                setSession(nextSession);
            });

        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                if (role === 'player' && myTeam) {
                    await channel.track({
                        id: playerId,
                        teamName: myTeam.name,
                        balance: myTeam.balance,
                        activeBet: myTeam.activeBet,
                        updatedAt: Date.now()
                    });
                }
                if (role === 'player') {
                    channel.send({ type: 'broadcast', event: 'request_state', payload: {} });
                }
            }
        });

        if (role === 'host') {
            channel.on('broadcast', { event: 'request_state' }, () => {
                if (session) {
                    channel.send({ type: 'broadcast', event: 'slide_change', payload: { session } });
                }
            });
        }

        return () => {
            channel.unsubscribe();
        };
    }, [supabase, lobbyId, role, playerId]);

    const skipToEnd = () => {
        if (!session || !channelRef.current) return;

        // A rigid confirmation box fits the theme perfectly
        if (!window.confirm("Varning: Är du säker på att du vill avbryta pågående utmaningar och hoppa direkt till slutresultatet?")) return;

        const updatedSession: SessionData = {
            ...session,
            currentSlideIndex: CHALLENGES.length + 1, // Pushing it past the array length triggers the end screen
            state: 'ended',
            lastWinner: null
        };
        setSession(updatedSession);
        channelRef.current.send({ type: 'broadcast', event: 'slide_change', payload: { session: updatedSession } });
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const lobbyParam = params.get('lobby');
        if (lobbyParam) {
            setLobbyId(lobbyParam.toUpperCase());
            setRole('player');
        }
    }, []);

    useEffect(() => {
        if (role !== 'player' || !lobbyId || !playerId || myTeam) return;

        const storedTeam = loadStoredTeamIdentity(lobbyId);
        if (!storedTeam) return;

        const restoredTeam: Team = {
            id: playerId,
            name: storedTeam.teamName,
            balance: storedTeam.balance,
            activeBet: storedTeam.activeBet,
        };

        setMyTeam(restoredTeam);
        setNewTeamName(storedTeam.teamName);

        if (channelRef.current) {
            void channelRef.current.track({
                id: playerId,
                teamName: restoredTeam.name,
                balance: restoredTeam.balance,
                activeBet: restoredTeam.activeBet,
                updatedAt: Date.now()
            });
        }
    }, [role, lobbyId, playerId, myTeam]);

    const createLobby = () => {
        if (!supabase) {
            setErrorMessage("Kopplingen till Supabase är inte aktiv.");
            return;
        }
        const generatedId = Math.random().toString(36).substring(2, 6).toUpperCase();
        setLobbyId(generatedId);
        setRole('host');

        const newSession: SessionData = {
            id: generatedId,
            currentSlideIndex: 0,
            state: 'lobby',
            winningHistory: [],
            lastWinner: null
        };

        setSession(newSession);
        setTeams([]);
        setErrorMessage('');
    };

    const joinLobby = (e: FormEvent<HTMLFormElement>) => {
        if (e) e.preventDefault();
        if (!supabase) {
            setErrorMessage("Kopplingen till Supabase är inte aktiv.");
            return;
        }
        if (!lobbyId) {
            setErrorMessage("Ange spelkod.");
            return;
        }
        setLobbyId(lobbyId.trim().toUpperCase());
        setRole('player');
        setErrorMessage('');
    };

    const registerTeam = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!newTeamName.trim() || !channelRef.current || !session) return;

        const desiredName = newTeamName.trim();
        const existingTeam = teams.find((t) => normalizeTeamName(t.name) === normalizeTeamName(desiredName));
        const hasGameStarted = session.state !== 'lobby';
        const storedTeam = loadStoredTeamIdentity(lobbyId);
        const canRejoinFromStorage = !!storedTeam && normalizeTeamName(storedTeam.teamName) === normalizeTeamName(desiredName);

        if (!hasGameStarted && existingTeam) {
            setErrorMessage("Lagnamnet är upptaget!");
            return;
        }
        if (hasGameStarted && !existingTeam && !canRejoinFromStorage) {
            setErrorMessage("Spelet har startat. Endast befintliga lag kan återansluta.");
            return;
        }

        const newTeam: Team = {
            id: playerId,
            name: existingTeam?.name ?? desiredName,
            balance: existingTeam?.balance ?? storedTeam?.balance ?? 100,
            activeBet: existingTeam?.activeBet ?? storedTeam?.activeBet ?? null
        };

        setMyTeam(newTeam);
        setNewTeamName('');
        setErrorMessage('');
        persistTeamIdentity(newTeam, lobbyId);

        await channelRef.current.track({
            id: playerId,
            teamName: newTeam.name,
            balance: newTeam.balance,
            activeBet: newTeam.activeBet,
            updatedAt: Date.now()
        });
    };

    const placeBet = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selectedTeacherId || !betAmount || !channelRef.current || !myTeam) return;
        const amount = parseInt(betAmount, 10);

        if (myTeam.activeBet) { setErrorMessage("Bet redan lagt."); return; }
        if (isNaN(amount) || amount <= 0) { setErrorMessage("Ogiltigt belopp."); return; }
        if (amount > myTeam.balance) { setErrorMessage("Saldofel."); return; }

        const updatedBet = { teacherId: selectedTeacherId, amount: amount };
        const newBalance = myTeam.balance - amount;

        setMyTeam({ ...myTeam, balance: newBalance, activeBet: updatedBet });
        persistTeamIdentity({ ...myTeam, balance: newBalance, activeBet: updatedBet }, lobbyId);

        await channelRef.current.track({
            id: playerId,
            teamName: myTeam.name,
            balance: newBalance,
            activeBet: updatedBet,
            updatedAt: Date.now()
        });

        setErrorMessage('');
        setBetSuccessMsg(`Bet sparat.`);
        setTimeout(() => setBetSuccessMsg(''), 4000);
    };

    const cancelBet = async () => {
        if (!myTeam || !myTeam.activeBet || !channelRef.current) return;
        const newBalance = myTeam.balance + myTeam.activeBet.amount;
        setMyTeam({ ...myTeam, balance: newBalance, activeBet: null });
        persistTeamIdentity({ ...myTeam, balance: newBalance, activeBet: null }, lobbyId);
        await channelRef.current.track({
            id: playerId,
            teamName: myTeam.name,
            balance: newBalance,
            activeBet: null,
            updatedAt: Date.now()
        });
    };

    const nextSlide = () => {
        if (!session || !channelRef.current) return;
        const nextIndex = session.currentSlideIndex + 1;
        const updatedSession: SessionData = {
            ...session,
            currentSlideIndex: nextIndex,
            state: nextIndex > CHALLENGES.length ? 'ended' : 'betting',
            lastWinner: null
        };
        setSession(updatedSession);
        channelRef.current.send({ type: 'broadcast', event: 'slide_change', payload: { session: updatedSession } });
    };

    const resolveChallenge = async (winningTeacherId: string) => {
        if (!session || !channelRef.current) return;
        const currentChallenge = CHALLENGES[session.currentSlideIndex - 1];
        const winningTeacher = currentChallenge?.teachers.find(t => t.id === winningTeacherId);
        if (!winningTeacher) return;

        const updatedSession: SessionData = {
            ...session,
            state: 'result',
            winningHistory: [...(session.winningHistory || []), { challengeId: currentChallenge.id, winningTeacherId, winningTeacherName: winningTeacher.name }],
            lastWinner: winningTeacher
        };
        setSession(updatedSession);
        channelRef.current.send({ type: 'broadcast', event: 'round_resolved', payload: { session: updatedSession } });
    };

    useEffect(() => {
        if (role !== 'player' || !session || !myTeam || !channelRef.current) return;
        if (session.state === 'result' && session.lastWinner && myTeam.activeBet) {
            const isWin = myTeam.activeBet.teacherId === session.lastWinner.id;
            const newBalance = isWin ? myTeam.balance + Math.round(myTeam.activeBet.amount * session.lastWinner.odds) : myTeam.balance;

            const updatedTeam: Team = { ...myTeam, balance: newBalance, activeBet: null };
            setMyTeam(updatedTeam);
            persistTeamIdentity(updatedTeam, lobbyId);
            channelRef.current.track({ id: playerId, teamName: updatedTeam.name, balance: updatedTeam.balance, activeBet: null, updatedAt: Date.now() });
        }
    }, [session]);

    const resetEntireGame = () => {
        if (!session || !channelRef.current) return;
        const resetSession: SessionData = { ...session, currentSlideIndex: 0, state: 'lobby', winningHistory: [], lastWinner: null };
        setSession(resetSession);
        channelRef.current.send({ type: 'broadcast', event: 'slide_change', payload: { session: resetSession } });
    };

    const getTopTeacher = () => {
        if (!session?.winningHistory?.length) return "-";
        const counts: Record<string, number> = {};
        session.winningHistory.forEach(h => counts[h.winningTeacherName] = (counts[h.winningTeacherName] || 0) + 1);
        return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    };

    const buildJoinUrl = () => {
        const base = customBaseUrl ? customBaseUrl.trim() : window.location.origin + window.location.pathname;
        return `${base}${base.includes('?') ? '&' : '?'}lobby=${lobbyId}`;
    };

    const joinUrl = buildJoinUrl();
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(joinUrl)}`;
    const CURRENCY = "elebux";

    // FAKE SIDEBAR DATA FOR AUTHENTICITY
    const sidebarLinks = [
        { icon: Lightbulb, text: "Aktuellt" },
        { icon: Calendar, text: "Schema" },
        { icon: FileText, text: "Pedagogiskt stöd" },
        { icon: Check, text: "Bedömning" },
        { icon: FileText, text: "Ny betygsättning" },
        { icon: Users, text: "Grupper" },
        { icon: FileText, text: "Elevdokument" },
        { icon: BookOpen, text: "Kurs" },
        { icon: GraduationCap, text: "Elevavstämning (GY25)" },
        { icon: Users, text: "Mentor" },
        { icon: Folder, text: "Filer & länkar" },
        { icon: Folder, text: "Äldre funktioner" },
    ];

    return (
        <div className="min-h-screen bg-[#f4f7f9] text-gray-800 font-sans flex flex-col text-[13px]">

            {/* SCHOOLSOFT HEADER */}
            <header className="bg-[#e6f0f9] border-b border-[#c8d8e8] h-[52px] flex items-center justify-between px-4 sticky top-0 z-50">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="font-serif text-lg tracking-wider text-gray-800 flex items-center gap-1">
                            <img
                                src={logo}
                                alt="NTI Gymnasiet Logo"
                                className="h-9 w-auto object-contain mix-blend-multiply"
                            />
                        </div>
                    </div>

                    <div className="hidden md:flex gap-4 h-full items-center">
                        <button className="flex items-center gap-1 text-[#00529b] font-bold border-b-2 border-[#00529b] h-[52px] px-2">
                            <Home size={16} /> Startsida
                        </button>
                        <button className="flex items-center gap-1 text-gray-600 hover:text-[#00529b] h-[52px] px-2">
                            <Clock size={16} /> Närvaro
                        </button>
                        <button className="flex items-center gap-1 text-gray-600 hover:text-[#00529b] h-[52px] px-2">
                            <Wrench size={16} /> Admin
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex flex-col text-right border border-[#c8d8e8] bg-white px-3 py-1 rounded-sm">
                        <span className="text-gray-800 font-bold">NTI Gymnasiet Umeå</span>
                        <span className="text-gray-500 text-[10px]">30 min</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white border border-[#c8d8e8] px-2 py-1 rounded-sm cursor-pointer">
                        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center overflow-hidden">
                            <Users size={16} className="text-gray-500" />
                        </div>
                        <div className="flex flex-col pr-4">
                            <span className="font-bold text-gray-800 leading-tight">Jens Andreasson</span>
                            <span className="text-gray-500 text-[10px] leading-tight">Lärare</span>
                        </div>
                        <ChevronRight size={14} className="text-gray-400 rotate-90" />
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* FAKE SIDEBAR */}
                <aside className="w-[200px] bg-[#f8f9fa] border-r border-[#dee2e6] hidden md:flex flex-col shrink-0">
                    <div className="p-2 border-b border-[#dee2e6]">
                        <div className="flex items-center bg-white border border-[#ced4da] rounded-sm px-2 py-1">
                            <Search size={14} className="text-gray-400 mr-2" />
                            <input type="text" placeholder="Sök i menyn" className="w-full text-xs outline-none" />
                        </div>
                    </div>
                    <div className="py-2">
                        {sidebarLinks.map((link, i) => (
                            <div key={i} className="flex items-center justify-between px-4 py-2 hover:bg-[#e6f0f9] cursor-pointer text-gray-700">
                                <div className="flex items-center gap-2">
                                    <link.icon size={16} className="text-[#00529b]" />
                                    <span>{link.text}</span>
                                </div>
                                <ChevronRight size={14} className="text-gray-400" />
                            </div>
                        ))}
                    </div>
                </aside>

                {/* MAIN CONTENT AREA */}
                <main className="flex-1 p-4 bg-white m-2 md:m-4 border border-[#dee2e6] shadow-sm rounded-sm overflow-y-auto relative">

                    {/* Floating Help Button */}
                    <div className="absolute bottom-4 right-4 text-[#00529b] cursor-pointer">
                        <HelpCircle size={36} fill="#e6f0f9" />
                    </div>

                    <div className="max-w-4xl mx-auto space-y-4">

                        {/* Tab header aesthetic */}
                        <div className="flex gap-1 border-b border-[#00529b] mb-4 overflow-x-auto pb-[1px]">
                            {['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'].map((day) => (
                                <div key={day} className={`px-3 py-1 text-xs cursor-pointer ${day === 'Tisdag' ? 'bg-[#98c1e8] text-gray-900 border border-b-0 border-[#00529b]' : 'bg-[#e9ecef] text-gray-600 border border-[#ced4da] border-b-0 hover:bg-[#dee2e6]'}`}>
                                    {day}
                                </div>
                            ))}
                            <div className="px-3 py-1 text-xs cursor-pointer bg-[#e9ecef] text-[#00529b] border border-[#ced4da] border-b-0 flex items-center gap-1">
                                <ChevronLeft size={12} /> Vecka 24 <ChevronRight size={12} />
                            </div>
                        </div>

                        {/* Title Row */}
                        <div className="flex justify-between items-center mb-4">
                            <h1 className="text-lg font-bold text-[#00529b]">Lärarutmaningen (Applikation)</h1>
                            {role && (
                                <span className="text-[11px] bg-[#e9ecef] border border-[#ced4da] px-2 py-1 text-gray-600 font-bold uppercase">
                                    {role === 'host' ? 'Lärare vy' : 'Elev vy'}
                                </span>
                            )}
                        </div>

                        {/* Errors/Messages */}
                        {errorMessage && (
                            <div className="bg-[#f8d7da] border border-[#f5c6cb] text-[#721c24] px-3 py-2 rounded-sm flex items-start gap-2 mb-4">
                                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                <div>
                                    <strong>Felmeddelande:</strong> {errorMessage}
                                </div>
                            </div>
                        )}
                        {betSuccessMsg && (
                            <div className="bg-[#d4edda] border border-[#c3e6cb] text-[#155724] px-3 py-2 rounded-sm mb-4">
                                {betSuccessMsg}
                            </div>
                        )}

                        {/* ==================== ROLE SELECTION ==================== */}
                        {!role && !errorMessage && (
                            <div className="flex flex-col md:flex-row gap-4">
                                {/* Skapa spel panel */}
                                <div className="flex-1 border border-[#ced4da] rounded-sm">
                                    <div className="bg-[#f8f9fa] border-b border-[#ced4da] px-3 py-2 font-bold text-[#00529b] flex items-center gap-2">
                                        <Award size={16} /> Skapa ny session
                                    </div>
                                    <div className="p-4 space-y-4">
                                        <p className="text-gray-600">Starta en ny instans av utmaningen för att projicera på tavlan.</p>
                                        <button onClick={createLobby} className="bg-[#f8f9fa] border border-[#ced4da] text-gray-800 hover:bg-[#e2e6ea] px-4 py-2 font-bold shadow-sm w-full md:w-auto">
                                            Starta applikation
                                        </button>
                                    </div>
                                </div>

                                {/* Anslut panel */}
                                <div className="flex-1 border border-[#ced4da] rounded-sm">
                                    <div className="bg-[#f8f9fa] border-b border-[#ced4da] px-3 py-2 font-bold text-[#00529b] flex items-center gap-2">
                                        <Users size={16} /> Anslut till session
                                    </div>
                                    <form onSubmit={joinLobby} className="p-4 space-y-4">
                                        <p className="text-gray-600">Mata in PIN-kod för att ansluta ditt lag.</p>
                                        <input
                                            type="text"
                                            value={lobbyId}
                                            onChange={(e) => setLobbyId(e.target.value.toUpperCase())}
                                            className="w-full border border-[#ced4da] px-3 py-2 focus:border-[#80bdff] focus:ring-1 focus:ring-[#80bdff] outline-none font-bold uppercase tracking-widest"
                                        />
                                        <button type="submit" className="bg-[#00529b] text-white hover:bg-[#004080] border border-[#004080] px-4 py-2 font-bold shadow-sm w-full md:w-auto">
                                            Gå med
                                        </button>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* ==================== HOST VIEW ==================== */}
                        {role === 'host' && session && (
                            <div className="space-y-4">
                                {/* Admin top bar */}
                                <div className="bg-[#fff3cd] border border-[#ffeeba] text-[#856404] px-3 py-2 text-xs flex justify-between items-center">
                                    <span><strong>Aktiv session:</strong> {lobbyId}</span>
                                    <button onClick={() => setShowUrlSettings(!showUrlSettings)} className="underline text-[#00529b]">Konfigurera länkar</button>
                                </div>

                                {showUrlSettings && (
                                    <div className="border border-[#ced4da] bg-[#f8f9fa] p-3 space-y-2 mb-4 text-xs">
                                        <label className="font-bold">Anpassad bas-URL:</label>
                                        <input type="text" value={customBaseUrl} onChange={(e) => setCustomBaseUrl(e.target.value)} className="w-full border border-[#ced4da] px-2 py-1" />
                                    </div>
                                )}

                                {/* LOBBY */}
                                {session.currentSlideIndex === 0 && (
                                    <div className="border border-[#ced4da] rounded-sm flex flex-col md:flex-row">
                                        <div className="flex-1 p-6 space-y-4 border-b md:border-b-0 md:border-r border-[#ced4da]">
                                            <h2 className="text-[#00529b] text-xl font-bold">Väntar på deltagare...</h2>
                                            <p>Lag ansluter med koden <strong>{lobbyId}</strong> eller genom att skanna QR-koden.</p>
                                            <p className="text-gray-500 italic">Varje lag tilldelas 100 {CURRENCY} vid start.</p>
                                            <button onClick={nextSlide} className="bg-[#00529b] text-white border border-[#004080] px-4 py-2 font-bold mt-4">
                                                Påbörja utmaning &raquo;
                                            </button>
                                        </div>
                                        <div className="p-6 bg-[#f8f9fa] flex flex-col items-center justify-center min-w-[250px]">
                                            <img src={qrCodeUrl} alt="QR" className="w-40 h-40 border border-gray-300 p-1 bg-white" />
                                            <span className="text-[10px] text-gray-500 mt-2 text-center break-all">{joinUrl}</span>
                                        </div>
                                    </div>
                                )}

                                {/* GAME SCREEN */}
                                {session.currentSlideIndex > 0 && session.currentSlideIndex <= CHALLENGES.length && (
                                    <div className="flex flex-col md:flex-row gap-4">

                                        {/* Main Content */}
                                        <div className="flex-[2] border border-[#ced4da]">
                                            <div className="bg-[#f8f9fa] border-b border-[#ced4da] px-3 py-2 font-bold text-[#00529b] flex justify-between">
                                                <span>Delmoment {session.currentSlideIndex} av {CHALLENGES.length}</span>
                                                <span className="text-gray-500">{CHALLENGES[session.currentSlideIndex - 1].title}</span>
                                                <button
                                                    onClick={skipToEnd}
                                                    className="text-[10px] uppercase bg-white text-[#721c24] border border-[#f5c6cb] px-2 py-0.5 hover:bg-[#f8d7da] transition-colors"
                                                    title="Hoppa till slutresultat"
                                                >
                                                    Avsluta
                                                </button>
                                            </div>
                                            <div className="p-4 space-y-4">
                                                <p className="bg-white border border-[#e2e6ea] p-3 text-gray-700 italic">
                                                    {CHALLENGES[session.currentSlideIndex - 1].description}
                                                </p>

                                                <table className="w-full border-collapse border border-[#ced4da] text-left">
                                                    <thead className="bg-[#e9ecef]">
                                                        <tr>
                                                            <th className="border border-[#ced4da] px-2 py-1 w-1/2">Kandidat</th>
                                                            <th className="border border-[#ced4da] px-2 py-1">Odds</th>
                                                            <th className="border border-[#ced4da] px-2 py-1 text-center">Åtgärd</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {CHALLENGES[session.currentSlideIndex - 1].teachers.map((t) => (
                                                            <tr key={t.id} className={session.lastWinner?.id === t.id ? 'bg-[#d4edda]' : 'hover:bg-[#f8f9fa]'}>
                                                                <td className="border border-[#ced4da] px-2 py-1 font-bold">{t.name}</td>
                                                                <td className="border border-[#ced4da] px-2 py-1 text-[#00529b]">{t.odds}</td>
                                                                <td className="border border-[#ced4da] px-2 py-1 text-center">
                                                                    {session.state === 'betting' ? (
                                                                        <button onClick={() => resolveChallenge(t.id)} className="text-xs text-[#00529b] underline">
                                                                            Markera vinnare
                                                                        </button>
                                                                    ) : (
                                                                        session.lastWinner?.id === t.id && <span className="text-[#155724] font-bold text-xs flex items-center justify-center gap-1"><Check size={12} /> Vinnare</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>

                                                {session.state === 'result' && (
                                                    <div className="text-right mt-4">
                                                        <button onClick={nextSlide} className="bg-[#f8f9fa] border border-[#ced4da] text-gray-800 hover:bg-[#e2e6ea] px-4 py-1.5 font-bold">
                                                            Nästa &raquo;
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Sidebar - Teams */}
                                        <div className="flex-1 border border-[#ced4da] bg-[#f8f9fa] flex flex-col h-fit">
                                            <div className="bg-[#e9ecef] border-b border-[#ced4da] px-3 py-2 font-bold text-gray-700">
                                                Mottagna insatser ({teams.filter(t => t.activeBet).length}/{teams.length})
                                            </div>
                                            <ul className="p-0 m-0 list-none max-h-[300px] overflow-y-auto bg-white">
                                                {teams.map((t) => (
                                                    <li key={t.id} className="border-b border-[#f1f3f5] px-3 py-2 flex justify-between items-center">
                                                        <span className="truncate w-1/2">{t.name}</span>
                                                        {t.activeBet ? (
                                                            session.state === 'result' ? (
                                                                <span className="text-[10px] text-gray-500">{t.activeBet.amount}p ({CHALLENGES[session.currentSlideIndex - 1].teachers.find(teacher => teacher.id === t.activeBet?.teacherId)?.name.split(' ')[0]})</span>
                                                            ) : (
                                                                <span className="text-[#28a745] text-xs font-bold flex items-center gap-1"><Check size={10} />Klar</span>
                                                            )
                                                        ) : (
                                                            <span className="text-[10px] text-gray-400 italic">Väntar...</span>
                                                        )}
                                                    </li>
                                                ))}
                                                {teams.length === 0 && <li className="px-3 py-2 text-gray-500 italic">Inga lag anslutna.</li>}
                                            </ul>
                                        </div>
                                    </div>
                                )}

                                {/* END SCREEN */}
                                {session.currentSlideIndex > CHALLENGES.length && (
                                    <div className="border border-[#ced4da] rounded-sm max-w-2xl mx-auto">
                                        <div className="bg-[#00529b] text-white px-3 py-2 font-bold">Slutresultat</div>
                                        <div className="p-4">
                                            <table className="w-full border-collapse border border-[#ced4da] mb-4">
                                                <thead className="bg-[#e9ecef] text-left">
                                                    <tr>
                                                        <th className="border border-[#ced4da] px-2 py-1 w-10 text-center">Plats</th>
                                                        <th className="border border-[#ced4da] px-2 py-1">Lagnamn</th>
                                                        <th className="border border-[#ced4da] px-2 py-1 text-right">Poäng</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {teams.map((t, index) => (
                                                        <tr key={t.id} className={index === 0 ? 'bg-[#fff3cd] font-bold' : ''}>
                                                            <td className="border border-[#ced4da] px-2 py-1 text-center">{index + 1}</td>
                                                            <td className="border border-[#ced4da] px-2 py-1">{t.name}</td>
                                                            <td className="border border-[#ced4da] px-2 py-1 text-right">{t.balance} {CURRENCY}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            <div className="bg-[#f8f9fa] border border-[#ced4da] p-3 text-xs mb-4">
                                                <p><strong>Bästa lärare:</strong> {getTopTeacher()}</p>
                                                <p><strong>Antal ronder:</strong> {CHALLENGES.length}</p>
                                            </div>
                                            <button onClick={resetEntireGame} className="bg-[#f8f9fa] border border-[#ced4da] text-gray-800 px-3 py-1 text-xs">
                                                Ny spelomgång
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ==================== PLAYER VIEW ==================== */}
                        {role === 'player' && session && (
                            <div className="max-w-md space-y-4">

                                {/* Registration */}
                                {!myTeam && (
                                    <div className="border border-[#ced4da] bg-white rounded-sm">
                                        <div className="bg-[#f8f9fa] border-b border-[#ced4da] px-3 py-2 font-bold text-[#00529b]">Elevregistrering</div>
                                        <form onSubmit={registerTeam} className="p-4 space-y-3">
                                            <label className="block font-bold text-gray-700">Lagnamn:</label>
                                            <input type="text" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} maxLength={24} className="w-full border border-[#ced4da] px-2 py-1 outline-none focus:border-[#80bdff]" />
                                            <p className="text-[10px] text-gray-500">Tilldelas 100 {CURRENCY} vid godkännande.</p>
                                            <button type="submit" disabled={!newTeamName.trim()} className="bg-[#f8f9fa] border border-[#ced4da] text-gray-800 hover:bg-[#e2e6ea] px-3 py-1 font-bold disabled:opacity-50">Spara</button>
                                        </form>
                                    </div>
                                )}

                                {/* Waiting */}
                                {myTeam && session.currentSlideIndex === 0 && (
                                    <div className="border border-[#ced4da] bg-[#f8f9fa] p-4 text-center space-y-2">
                                        <Check size={24} className="text-[#28a745] mx-auto" />
                                        <h3 className="font-bold text-[#00529b]">Ansluten: {myTeam.name}</h3>
                                        <p className="text-gray-600 text-xs">Inväntar lärarens startsignal på projektorn.</p>
                                    </div>
                                )}

                                {/* Active Betting Area */}
                                {myTeam && session.currentSlideIndex > 0 && session.currentSlideIndex <= CHALLENGES.length && (
                                    <div className="space-y-4">
                                        <div className="flex justify-between border-b-2 border-[#00529b] pb-1">
                                            <span className="font-bold">Konto: <span className="text-[#00529b]">{myTeam.balance} {CURRENCY}</span></span>
                                            <span className="text-gray-500">Rond {session.currentSlideIndex}</span>
                                        </div>

                                        {myTeam.activeBet ? (
                                            <div className="border border-[#c3e6cb] bg-[#d4edda] p-3 text-[#155724] space-y-2 rounded-sm">
                                                <div className="font-bold border-b border-[#c3e6cb] pb-1">Kvitto: Insats mottagen</div>
                                                <p className="text-sm">Du har lagt <strong>{myTeam.activeBet.amount} {CURRENCY}</strong> på <strong>{CHALLENGES[session.currentSlideIndex - 1].teachers.find(t => t.id === myTeam.activeBet?.teacherId)?.name}</strong>.</p>
                                                {session.state === 'betting' && (
                                                    <button onClick={cancelBet} className="text-[#856404] underline text-xs">Ångra insats</button>
                                                )}

                                                {session.state === 'result' && (
                                                    <div className="mt-3 p-2 border border-[#856404] bg-[#fff3cd] text-[#856404] text-center font-bold">
                                                        {session.lastWinner?.id === myTeam.activeBet.teacherId
                                                            ? `Rätt! Vinst: ${Math.round(myTeam.activeBet.amount * session.lastWinner.odds)} ${CURRENCY}`
                                                            : 'Felaktigt. Insats förlorad.'}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            session.state === 'betting' ? (
                                                <form onSubmit={placeBet} className="border border-[#ced4da] bg-white">
                                                    <div className="bg-[#f8f9fa] border-b border-[#ced4da] px-3 py-2 font-bold">Inlämning av insats</div>
                                                    <div className="p-3 space-y-4">
                                                        <div>
                                                            <label className="block font-bold mb-1">Markera kandidat:</label>
                                                            <select
                                                                value={selectedTeacherId}
                                                                onChange={(e) => setSelectedTeacherId(e.target.value)}
                                                                className="w-full border border-[#ced4da] px-2 py-1 bg-white outline-none"
                                                            >
                                                                <option value="" disabled>-- Välj i listan --</option>
                                                                {CHALLENGES[session.currentSlideIndex - 1].teachers.map(t => (
                                                                    <option key={t.id} value={t.id}>{t.name} (Odds: {t.odds})</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block font-bold mb-1">Belopp:</label>
                                                            <div className="flex gap-2">
                                                                <input type="number" min="1" max={myTeam.balance} value={betAmount} onChange={(e) => setBetAmount(e.target.value)} className="flex-1 border border-[#ced4da] px-2 py-1 outline-none" placeholder="0" />
                                                                <button type="button" onClick={() => setBetAmount(myTeam.balance.toString())} className="bg-[#e9ecef] border border-[#ced4da] text-xs px-2 hover:bg-[#dee2e6]">Max</button>
                                                            </div>
                                                        </div>
                                                        <button type="submit" disabled={!selectedTeacherId || !betAmount} className="bg-[#00529b] text-white w-full py-1.5 font-bold disabled:opacity-50">
                                                            Skicka in
                                                        </button>
                                                    </div>
                                                </form>
                                            ) : (
                                                <div className="border border-[#f5c6cb] bg-[#f8d7da] text-[#721c24] p-3 text-center">
                                                    <strong>Inlämning stängd.</strong> Invänter bedömning från lärare.
                                                </div>
                                            )
                                        )}
                                    </div>
                                )}

                                {/* Player End Screen */}
                                {myTeam && session.currentSlideIndex > CHALLENGES.length && (
                                    <div className="border border-[#ced4da] bg-[#f8f9fa] p-4 text-center space-y-2">
                                        <h3 className="font-bold text-[#00529b]">Moment avslutat</h3>
                                        <div className="bg-white border border-[#ced4da] p-2 mt-2 inline-block mx-auto text-left">
                                            <p>Lag: <strong>{myTeam.name}</strong></p>
                                            <p>Resultat: <strong>{myTeam.balance} {CURRENCY}</strong></p>
                                        </div>
                                    </div>
                                )}

                            </div>
                        )}

                    </div>
                </main>
            </div>
        </div>
    );
}