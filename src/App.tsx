import { useState, useEffect, useRef, type FormEvent, type SyntheticEvent } from 'react';
import {
    Users,
    Play,
    ChevronRight,
    Coins,
    Trophy,
    Check,
    AlertCircle,
    RefreshCw,
    Award,
    ArrowRight,
    ShieldAlert,
    Settings,
} from 'lucide-react';

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
        description: "Någralärare med förkärlek för papercuts ska vika och sedan kasta ett pappersflygplan så långt som möjligt.",
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

    // Realtidstillstånd
    const [session, setSession] = useState<SessionData | null>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [myTeam, setMyTeam] = useState<Team | null>(null);

    const [errorMessage, setErrorMessage] = useState('');
    const [newTeamName, setNewTeamName] = useState('');
    const [customBaseUrl, setCustomBaseUrl] = useState('');
    const [showUrlSettings, setShowUrlSettings] = useState(false);

    // Bettingval för spelare
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
            if (
                parsed.lobbyId !== currentLobbyId ||
                typeof parsed.teamName !== 'string' ||
                !parsed.teamName.trim()
            ) {
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

    // 1. Dynamisk laddning av Supabase SDK från CDN (Helt utan npm-krockar!)
    useEffect(() => {
        if (window.supabase) {
            setSupabaseReady(true);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.async = true;
        script.onload = () => {
            setSupabaseReady(true);
        };
        script.onerror = () => {
            setErrorMessage("Kunde inte ladda ner Supabase Realtime-biblioteket från CDN.");
        };
        document.body.appendChild(script);
        return () => {
            if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
        };
    }, []);

    // 2. Initiera Supabase-klienten när CDN är laddat och nycklar finns i .env
    useEffect(() => {
        if (supabaseReady && window.supabase) {
            if (!supabaseUrl || !supabaseKey) {
                setErrorMessage("Supabase-miljövariabler saknas! Kontrollera att du har lagt till VITE_SUPABASE_URL och VITE_SUPABASE_ANON_KEY i din .env-fil i projektets rotmapp.");
                return;
            }

            try {
                const client = window.supabase.createClient(supabaseUrl.trim(), supabaseKey.trim());
                setSupabase(client);
                setErrorMessage('');
            } catch (err) {
                setErrorMessage("Kunde inte initiera Supabase. Kontrollera dina miljövariabler i .env.");
            }
        }
    }, [supabaseReady]);

    // 3. Skapa ett unikt ID för den här webbläsarfliken
    useEffect(() => {
        let pId = sessionStorage.getItem('betit_player_id');
        if (!pId) {
            pId = 'p-' + Math.random().toString(36).substring(2, 9);
            sessionStorage.setItem('betit_player_id', pId);
        }
        setPlayerId(pId);
        setCustomBaseUrl(window.location.origin + window.location.pathname);
    }, []);

    // ==========================================
    // REALTIDSSYNKRONISERING MED SUPABASE
    // ==========================================
    useEffect(() => {
        if (!supabase || !lobbyId) return;

        // Vi skapar en gemensam kanal för spelet baserat på lobbyId
        const channel = supabase.channel(`menti-${lobbyId}`, {
            config: {
                presence: {
                    key: playerId || 'host',
                },
            },
        });

        channelRef.current = channel;

        // Lyssnare för realtidshändelser
        channel
            // A. Presence - Spåra anslutna lag och deras dynamiska saldon/bets
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

                // Sortera poängtavlan (mest poäng överst)
                activeTeams.sort((a, b) => b.balance - a.balance);
                setTeams(activeTeams);

                // Matcha mitt eget lag i listan
                const me = activeTeams.find(t => t.id === playerId);
                if (me) setMyTeam(me);
            })
            // B. Broadcast - Ta emot slide-byten från spelledaren
            .on('broadcast', { event: 'slide_change' }, ({ payload }) => {
                const nextSession = payload.session as SessionData;
                setSession(nextSession);
                // Nollställ gamla inmatningsfält på mobilen inför nya utmaningen
                setSelectedTeacherId('');
                setBetAmount('');
            })
            // C. Broadcast - Ta emot rättningsresultat från spelledaren
            .on('broadcast', { event: 'round_resolved' }, ({ payload }) => {
                const nextSession = payload.session as SessionData;
                setSession(nextSession);
            });

        // Anslut till kanalen
        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                // Om jag är spelare och redan har ett registrerat lag, spåra mig i kanalen direkt
                if (role === 'player' && myTeam) {
                    await channel.track({
                        id: playerId,
                        teamName: myTeam.name,
                        balance: myTeam.balance,
                        activeBet: myTeam.activeBet,
                        updatedAt: Date.now()
                    });
                }

                // Nyanlända spelare ber om att få det aktuella slide-tillståndet från spelledaren
                if (role === 'player') {
                    channel.send({
                        type: 'broadcast',
                        event: 'request_state',
                        payload: {}
                    });
                }
            }
        });

        // Om jag är spelledare (Host), svara nyanlända spelare med aktuellt tillstånd
        if (role === 'host') {
            channel.on('broadcast', { event: 'request_state' }, () => {
                if (session) {
                    channel.send({
                        type: 'broadcast',
                        event: 'slide_change',
                        payload: { session }
                    });
                }
            });
        }

        return () => {
            channel.unsubscribe();
        };
    }, [supabase, lobbyId, role, playerId]);

    // Kolla om en spelkod finns med i URL-länken för direkt anslutning
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const lobbyParam = params.get('lobby');
        if (lobbyParam) {
            setLobbyId(lobbyParam.toUpperCase());
            setRole('player');
        }
    }, []);

    // Förifyll lag vid återanslutning om vi har sparad team-identitet för samma lobby
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

    // ==========================================
    // SPELREGLER & LOGIK
    // ==========================================

    // Skapa lobby (Host)
    const createLobby = () => {
        if (!supabase) {
            setErrorMessage("Kopplingen till Supabase är inte aktiv. Kontrollera dina miljövariabler (.env).");
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

    // Anslut till lobby (Player)
    const joinLobby = (e: FormEvent<HTMLFormElement>) => {
        if (e) e.preventDefault();
        if (!supabase) {
            setErrorMessage("Kopplingen till Supabase är inte aktiv. Kontrollera dina miljövariabler (.env).");
            return;
        }
        if (!lobbyId) {
            setErrorMessage("Du måste ange en spelkod.");
            return;
        }
        const cleanId = lobbyId.trim().toUpperCase();
        setLobbyId(cleanId);
        setRole('player');
        setErrorMessage('');
    };

    // Registrera lagnamn (Player)
    const registerTeam = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!newTeamName.trim() || !channelRef.current) return;

        if (!session) {
            setErrorMessage("Väntar på sessionstatus från spelledaren. Försök igen om en sekund.");
            return;
        }

        const desiredName = newTeamName.trim();
        const existingTeam = teams.find((t) => normalizeTeamName(t.name) === normalizeTeamName(desiredName));
        const hasGameStarted = session.state !== 'lobby';
        const storedTeam = loadStoredTeamIdentity(lobbyId);
        const canRejoinFromStorage = !!storedTeam && normalizeTeamName(storedTeam.teamName) === normalizeTeamName(desiredName);

        if (!hasGameStarted && existingTeam) {
            setErrorMessage("Lagnamnet är upptaget! Välj ett annat.");
            return;
        }

        if (hasGameStarted && !existingTeam && !canRejoinFromStorage) {
            setErrorMessage("Spelet har startat. Endast befintliga lag kan återansluta med sitt lagnamn.");
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

        // Rapportera laganslutning till Supabase Presence
        await channelRef.current.track({
            id: playerId,
            teamName: newTeam.name,
            balance: newTeam.balance,
            activeBet: newTeam.activeBet,
            updatedAt: Date.now()
        });
    };

    // Placera ett bet (Player)
    const placeBet = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selectedTeacherId || !betAmount || !channelRef.current || !myTeam) return;
        const amount = parseInt(betAmount, 10);

        if (myTeam.activeBet) {
            setErrorMessage("Du har redan låst ett bet för denna runda.");
            return;
        }

        if (isNaN(amount) || amount <= 0) {
            setErrorMessage("Ange ett giltigt belopp att betta.");
            return;
        }

        if (amount > myTeam.balance) {
            setErrorMessage(`Saldofel! Du har bara ${myTeam.balance} {CURRENCY} kvar.`);
            return;
        }

        const updatedBet = {
            teacherId: selectedTeacherId,
            amount: amount
        };

        const newBalance = myTeam.balance - amount;

        setMyTeam({
            ...myTeam,
            balance: newBalance,
            activeBet: updatedBet
        });

        persistTeamIdentity({
            ...myTeam,
            balance: newBalance,
            activeBet: updatedBet
        }, lobbyId);

        // Uppdatera mitt saldo och aktiva bet i Supabase Presence
        await channelRef.current.track({
            id: playerId,
            teamName: myTeam.name,
            balance: newBalance,
            activeBet: updatedBet,
            updatedAt: Date.now()
        });

        setErrorMessage('');
        setBetSuccessMsg(`Ditt bet på ${amount} {CURRENCY} är registrerat!`);
        setTimeout(() => setBetSuccessMsg(''), 4000);
    };

    // Ta bort ett lagt bet innan rundan stängs
    const cancelBet = async () => {
        if (!myTeam || !myTeam.activeBet || !channelRef.current) return;
        const refundAmount = myTeam.activeBet.amount;
        const newBalance = myTeam.balance + refundAmount;

        setMyTeam({
            ...myTeam,
            balance: newBalance,
            activeBet: null
        });

        persistTeamIdentity({
            ...myTeam,
            balance: newBalance,
            activeBet: null
        }, lobbyId);

        await channelRef.current.track({
            id: playerId,
            teamName: myTeam.name,
            balance: newBalance,
            activeBet: null,
            updatedAt: Date.now()
        });
    };

    // Gå till nästa slide / runda (Host)
    const nextSlide = () => {
        if (!session || !channelRef.current) return;
        const nextIndex = session.currentSlideIndex + 1;
        const isEnd = nextIndex > CHALLENGES.length;

        const updatedSession: SessionData = {
            ...session,
            currentSlideIndex: nextIndex,
            state: isEnd ? 'ended' : 'betting',
            lastWinner: null
        };

        setSession(updatedSession);

        // Skicka ut slide-förändring till alla deltagare i realtid
        channelRef.current.send({
            type: 'broadcast',
            event: 'slide_change',
            payload: { session: updatedSession }
        });
    };

    // Kora vinnare och dela ut poäng (Host)
    const resolveChallenge = async (winningTeacherId: string) => {
        if (!session || !channelRef.current) return;
        const currentChallenge = CHALLENGES[session.currentSlideIndex - 1];
        if (!currentChallenge) return;
        const winningTeacher = currentChallenge.teachers.find(t => t.id === winningTeacherId);
        if (!winningTeacher) return;

        const updatedHistory = [...(session.winningHistory || []), {
            challengeId: currentChallenge.id,
            winningTeacherId: winningTeacherId,
            winningTeacherName: winningTeacher.name
        }];

        const updatedSession: SessionData = {
            ...session,
            state: 'result',
            winningHistory: updatedHistory,
            lastWinner: winningTeacher
        };

        setSession(updatedSession);

        // Skicka ut rättningen till alla anslutna enheter i realtid
        channelRef.current.send({
            type: 'broadcast',
            event: 'round_resolved',
            payload: { session: updatedSession }
        });
    };

    // Automatisk poängberäkning på spelarens mobil när spelledaren rättar rundan
    useEffect(() => {
        if (role !== 'player' || !session || !myTeam || !channelRef.current) return;

        if (session.state === 'result' && session.lastWinner && myTeam.activeBet) {
            const winningTeacherId = session.lastWinner.id;

            if (myTeam.activeBet.teacherId === winningTeacherId) {
                // VINST: Utbetalning (insats * odds)
                const winnings = Math.round(myTeam.activeBet.amount * session.lastWinner.odds);
                const newBalance = myTeam.balance + winnings;
                const updatedTeam: Team = { ...myTeam, balance: newBalance, activeBet: null };
                setMyTeam(updatedTeam);
                persistTeamIdentity(updatedTeam, lobbyId);

                // Rapportera nytt saldo till presentationstavlan
                channelRef.current.track({
                    id: playerId,
                    teamName: updatedTeam.name,
                    balance: updatedTeam.balance,
                    activeBet: null,
                    updatedAt: Date.now()
                });
            } else {
                const updatedTeam: Team = { ...myTeam, activeBet: null };
                setMyTeam(updatedTeam);
                persistTeamIdentity(updatedTeam, lobbyId);

                // FÖRLUST: Nollställ bara aktivt bet (pengarna drogs redan när bettet låstes)
                channelRef.current.track({
                    id: playerId,
                    teamName: updatedTeam.name,
                    balance: updatedTeam.balance,
                    activeBet: null,
                    updatedAt: Date.now()
                });
            }
        }
    }, [session]);

    // Starta om spelet (Host)
    const resetEntireGame = () => {
        if (!session || !channelRef.current) return;

        const resetSession: SessionData = {
            ...session,
            currentSlideIndex: 0,
            state: 'lobby',
            winningHistory: [],
            lastWinner: null
        };

        setSession(resetSession);

        // Meddela nollställning till alla spelare
        channelRef.current.send({
            type: 'broadcast',
            event: 'slide_change',
            payload: { session: resetSession }
        });
    };

    // Hämta mest framgångsrika läraren
    const getTopTeacher = () => {
        if (!session || !session.winningHistory || session.winningHistory.length === 0) return "Ingen";
        const counts: Record<string, number> = {};
        session.winningHistory.forEach(h => {
            counts[h.winningTeacherName] = (counts[h.winningTeacherName] || 0) + 1;
        });

        let topTeacherName = "";
        let maxWins = 0;
        Object.keys(counts).forEach(name => {
            if (counts[name] > maxWins) {
                maxWins = counts[name];
                topTeacherName = name;
            }
        });

        return `${topTeacherName} (${maxWins} vinster)`;
    };

    const buildJoinUrl = () => {
        const base = customBaseUrl ? customBaseUrl.trim() : window.location.origin + window.location.pathname;
        const separator = base.includes('?') ? '&' : '?';
        return `${base}${separator}lobby=${lobbyId}`;
    };

    const joinUrl = buildJoinUrl();
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(joinUrl)}`;

    const CURRENCY = "elebux"
    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col justify-between">

            {/* HEADER */}
            <header className="border-b border-slate-800 bg-slate-950 p-4 sticky top-0 z-50 animate-fadeIn">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 rounded-lg text-white font-bold tracking-wider">
                            BET-IT!
                        </div>
                        <h1 className="text-xl font-bold hidden sm:inline">Lärarutmaningen</h1>
                    </div>

                    {lobbyId && (
                        <div className="flex items-center gap-4 bg-slate-900 px-4 py-1.5 rounded-full border border-slate-700">
                            <span className="text-xs text-slate-400">Spelkod:</span>
                            <span className="text-lg font-mono font-bold tracking-widest text-emerald-400">{lobbyId}</span>
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        {role === 'host' && (
                            <button
                                onClick={() => setShowUrlSettings(!showUrlSettings)}
                                className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl transition text-slate-400 hover:text-white"
                                title="Länkinställningar"
                            >
                                <Settings size={18} />
                            </button>
                        )}

                        {role && (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 font-medium">
                                {role === 'host' ? 'Spelledare 👑' : 'Deltagare 📱'}
                            </span>
                        )}
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT AREA */}
            <main className="flex-grow max-w-6xl w-full mx-auto p-4 md:p-6 flex flex-col justify-center items-center">

                {/* Felmeddelanden (t.ex. om .env-nycklar saknas) */}
                {errorMessage && (
                    <div className="mb-6 w-full max-w-xl bg-red-950/80 border border-red-800 text-red-200 px-4 py-4 rounded-xl flex items-start gap-3 shadow-lg">
                        <AlertCircle className="shrink-0 text-red-400 mt-0.5" />
                        <div className="text-sm">
                            <span className="font-bold block mb-1">Ett fel uppstod</span>
                            <p className="text-xs text-red-300 leading-relaxed">{errorMessage}</p>
                        </div>
                    </div>
                )}

                {betSuccessMsg && (
                    <div className="mb-6 w-full max-w-xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 px-4 py-3 rounded-xl text-sm shadow-lg">
                        {betSuccessMsg}
                    </div>
                )}

                {/* ==========================================
            START-VYN (VÄLJ ROLL)
           ========================================== */}
                {!role && !errorMessage && (
                    <div className="w-full max-w-4xl space-y-8 animate-fadeIn">
                        <div className="grid md:grid-cols-2 gap-8">
                            {/* VÄNSTER: Starta som spelledare */}
                            <div className="bg-slate-950/50 p-8 rounded-3xl border border-indigo-500/30 flex flex-col justify-between hover:border-indigo-500/50 transition">
                                <div>
                                    <div className="w-12 h-12 bg-indigo-600/20 text-indigo-400 rounded-xl flex items-center justify-center mb-6">
                                        <Award size={24} />
                                    </div>
                                    <h2 className="text-2xl font-bold mb-3">Visa på storskärm</h2>
                                    <p className="text-slate-400 mb-6 leading-relaxed text-sm">
                                        Ska du hålla i utmaningen? Öppna denna flik på projektorn/storskärmen för att visa QR-koden, oddsen och poängtavlan i realtid.
                                    </p>
                                </div>
                                <button
                                    onClick={createLobby}
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-bold transition flex items-center justify-center gap-2 text-lg shadow-lg shadow-indigo-600/20"
                                >
                                    <Play size={20} />
                                    Starta Nytt Spel
                                </button>
                            </div>

                            {/* HÖGER: Anslut som deltagare */}
                            <div className="bg-slate-950/50 p-8 rounded-3xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition">
                                <div>
                                    <div className="w-12 h-12 bg-emerald-600/20 text-emerald-400 rounded-xl flex items-center justify-center mb-6">
                                        <Users size={24} />
                                    </div>
                                    <h2 className="text-2xl font-bold mb-3">Anslut som lag</h2>
                                    <p className="text-slate-400 mb-6 leading-relaxed text-sm">
                                        Använd denna vy på din mobil (eller en ny flik) för att registrera ditt lag, hålla koll på era poäng och placera era bets.
                                    </p>
                                </div>
                                <form onSubmit={joinLobby} className="space-y-3">
                                    <input
                                        type="text"
                                        placeholder="SPELKOD (t.ex. AB12)"
                                        value={lobbyId}
                                        onChange={(e) => setLobbyId(e.target.value.toUpperCase())}
                                        className="w-full bg-slate-900 border border-slate-700 px-4 py-3.5 rounded-xl font-mono text-center text-xl tracking-widest text-emerald-400 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                    <button
                                        type="submit"
                                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-bold transition flex items-center justify-center gap-2 text-lg shadow-lg shadow-emerald-600/20"
                                    >
                                        <ArrowRight size={20} />
                                        Anslut till lobby
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* LÄNKINSTÄLLNINGAR POPUP */}
                {role === 'host' && showUrlSettings && (
                    <div className="mb-6 w-full max-w-xl bg-slate-950 p-6 rounded-2xl border border-indigo-500/30 text-left space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <Settings size={18} className="text-indigo-400" />
                                QR-kod & Länkinställningar
                            </h3>
                            <button
                                onClick={() => setShowUrlSettings(false)}
                                className="text-xs text-slate-400 hover:text-white"
                            >
                                Stäng [x]
                            </button>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Klistra in din StackBlitz- eller Vercel-länk här nedanför så uppdateras QR-koden direkt för alla deltagare!
                        </p>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase">Bas-URL för deltagare</label>
                            <input
                                type="text"
                                value={customBaseUrl}
                                onChange={(e) => setCustomBaseUrl(e.target.value)}
                                placeholder="https://vitejs-xxx.stackblitz.io"
                                className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl text-sm font-mono text-slate-300 focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                        <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 text-xs flex justify-between items-center">
                            <span className="text-slate-400">Genererad anslutningslänk:</span>
                            <span className="font-mono text-emerald-400 truncate max-w-[280px]">{joinUrl}</span>
                        </div>
                    </div>
                )}

                {/* ==========================================
            SPELLEDARENS GRÄNSSNITT (HOST)
           ========================================== */}
                {role === 'host' && session && (
                    <div className="w-full space-y-6 animate-fadeIn">

                        {/* LOBBY-STADIET */}
                        {session.currentSlideIndex === 0 && (
                            <div className="grid md:grid-cols-2 gap-8 items-center bg-slate-950/30 p-8 rounded-3xl border border-slate-800">
                                <div className="space-y-6 text-center md:text-left">
                                    <h2 className="text-4xl font-black tracking-tight text-white leading-tight">
                                        Anslut ditt lag med mobilen!
                                    </h2>
                                    <p className="text-slate-400 text-base leading-relaxed">
                                        Varje lag börjar med <strong className="text-emerald-400">100 {CURRENCY}</strong> att betta för.
                                        Skanna QR-koden eller skriv in koden manuellt.
                                    </p>
                                    <p className="text-xs text-amber-300/90">
                                        Efter att första utmaningen startat låses nya lagnamn. Befintliga lag kan dock återansluta med samma namn.
                                    </p>

                                    <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-2">
                                        <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold text-indigo-400">Anslutningslänk</p>
                                        <p className="text-sm font-medium break-all text-slate-300">{joinUrl}</p>
                                        <div className="flex justify-center md:justify-start gap-4 mt-2">
                                            <span className="text-sm bg-indigo-950 text-indigo-300 px-3 py-1 rounded-full border border-indigo-800 font-semibold">Kod: <strong className="font-mono text-white text-base">{lobbyId}</strong></span>
                                            <button
                                                onClick={() => setShowUrlSettings(true)}
                                                className="text-xs text-amber-400 hover:underline flex items-center gap-1"
                                            >
                                                <Settings size={12} />
                                                Konfigurera QR-länk
                                            </button>
                                        </div>
                                    </div>

                                    <div className="pt-4">
                                        <button
                                            onClick={nextSlide}
                                            className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-xl font-bold transition text-lg flex items-center justify-center gap-3 shadow-lg"
                                        >
                                            Starta första utmaningen
                                            <ChevronRight size={20} />
                                        </button>
                                    </div>
                                </div>

                                {/* QR Kod Visning */}
                                <div className="flex flex-col items-center justify-center bg-white p-6 rounded-3xl shadow-2xl max-w-sm mx-auto w-full">
                                    <img
                                        src={qrCodeUrl}
                                        alt="QR Kod för anslutning"
                                        className="w-full aspect-square max-h-[300px]"
                                        onError={(e: SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                    <div className="mt-4 text-center">
                                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Skanna för att spela!</p>
                                        <span className="text-xs font-semibold text-slate-800 block break-all leading-tight">{joinUrl}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* UTMANINGSSKÄRM */}
                        {session.currentSlideIndex > 0 && session.currentSlideIndex <= CHALLENGES.length && (
                            <div className="space-y-6">

                                <div className="bg-gradient-to-r from-indigo-950/60 to-slate-950/60 p-8 rounded-3xl border border-indigo-500/20">
                                    <div className="flex items-center gap-3 text-indigo-400 mb-2 font-semibold tracking-wider text-sm uppercase">
                                        <span>Utmaning {session.currentSlideIndex} av {CHALLENGES.length}</span>
                                    </div>
                                    <h2 className="text-3xl md:text-4xl font-black text-white mb-2">
                                        {CHALLENGES[session.currentSlideIndex - 1].title}
                                    </h2>
                                    <p className="text-slate-300 text-lg leading-relaxed max-w-3xl">
                                        {CHALLENGES[session.currentSlideIndex - 1].description}
                                    </p>
                                </div>

                                <div className="grid md:grid-cols-3 gap-6">

                                    {/* Lista över lärare */}
                                    <div className="md:col-span-2 bg-slate-950/40 p-6 rounded-3xl border border-slate-800 space-y-4">
                                        <h3 className="text-lg font-bold text-slate-300 mb-2 flex items-center gap-2">
                                            <Coins className="text-indigo-400" size={18} />
                                            Kandidater & odds
                                        </h3>

                                        <div className="grid sm:grid-cols-2 gap-4">
                                            {CHALLENGES[session.currentSlideIndex - 1].teachers.map((t) => {
                                                const isLastWinner = session.lastWinner?.id === t.id;
                                                return (
                                                    <div
                                                        key={t.id}
                                                        className={`p-5 rounded-2xl border transition ${session.state === 'result' && isLastWinner
                                                            ? 'bg-emerald-950/40 border-emerald-500'
                                                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                                                            }`}
                                                    >
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <h4 className="font-bold text-white text-lg">{t.name}</h4>
                                                                <span className="text-xs text-slate-500 uppercase font-semibold">Odds</span>
                                                                <p className="text-3xl font-black text-emerald-400 tracking-tight">{t.odds}x</p>
                                                            </div>

                                                            {session.state === 'betting' && (
                                                                <button
                                                                    onClick={() => resolveChallenge(t.id)}
                                                                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition shadow-md"
                                                                >
                                                                    Kora vinnare
                                                                </button>
                                                            )}

                                                            {session.state === 'result' && isLastWinner && (
                                                                <span className="bg-emerald-500 text-slate-950 px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1">
                                                                    <Check size={12} />
                                                                    Vinnare!
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Mottagna bets */}
                                    <div className="bg-slate-950/40 p-6 rounded-3xl border border-slate-800 flex flex-col justify-between">
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-300 mb-4 flex items-center gap-2">
                                                <Users className="text-emerald-400" size={18} />
                                                Mottagna bets ({teams.filter(t => t.activeBet).length}/{teams.length})
                                            </h3>

                                            <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-2">
                                                {teams.map((t) => {
                                                    const hasBet = !!t.activeBet;
                                                    const activeBet = t.activeBet;
                                                    return (
                                                        <div key={t.id} className="flex justify-between items-center text-sm p-2 bg-slate-900/40 rounded-lg border border-slate-800/60">
                                                            <span className="font-medium truncate text-slate-200">{t.name}</span>
                                                            <div className="flex items-center gap-2">
                                                                {hasBet ? (
                                                                    session.state === 'result' ? (
                                                                        <span className="text-slate-400 text-xs font-mono">
                                                                            {activeBet?.amount ?? 0}p på {CHALLENGES[session.currentSlideIndex - 1].teachers.find(teacher => teacher.id === activeBet?.teacherId)?.name.split(' ')[0]}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="bg-emerald-950/50 text-emerald-400 px-2 py-0.5 rounded text-xs border border-emerald-900/50 font-semibold flex items-center gap-1">
                                                                            Klar <Check size={10} />
                                                                        </span>
                                                                    )
                                                                ) : (
                                                                    <span className="text-slate-500 text-xs italic">Funderar...</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {teams.length === 0 && (
                                                    <p className="text-sm text-slate-500 italic text-center py-4">Inga lag anslutna än...</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-slate-800 mt-4">
                                            {session.state === 'result' ? (
                                                <button
                                                    onClick={nextSlide}
                                                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-xl font-bold transition flex items-center justify-center gap-2"
                                                >
                                                    Gå till nästa utmaning
                                                    <ChevronRight size={18} />
                                                </button>
                                            ) : (
                                                <div className="text-xs text-slate-400 text-center flex items-center justify-center gap-1.5 bg-slate-900/60 py-2.5 rounded-xl border border-slate-800">
                                                    <span className="animate-pulse w-2 h-2 rounded-full bg-amber-500"></span>
                                                    Väntar på att alla lag ska betta...
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SLUTSLIDE */}
                        {session.currentSlideIndex > CHALLENGES.length && (
                            <div className="space-y-8 text-center max-w-2xl mx-auto py-8">
                                <div className="inline-flex p-4 bg-amber-500/10 text-amber-400 rounded-3xl border border-amber-500/20 mb-2">
                                    <Trophy size={48} />
                                </div>
                                <h2 className="text-4xl md:text-5xl font-black text-white">Spelet är avgjort!</h2>

                                <div className="bg-slate-950/40 p-8 rounded-3xl border border-slate-800 space-y-6 text-left">
                                    <h3 className="text-xl font-bold text-slate-200 border-b border-slate-800 pb-3 flex items-center gap-2">
                                        <Award className="text-amber-400" />
                                        Slutresultat
                                    </h3>

                                    <div className="space-y-3">
                                        {teams.map((t, index) => {
                                            const isWinner = index === 0;
                                            return (
                                                <div
                                                    key={t.id}
                                                    className={`flex justify-between items-center p-4 rounded-xl border ${isWinner ? 'bg-amber-950/30 border-amber-500/50' : 'bg-slate-900/50 border-slate-800'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${isWinner ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                                                            }`}>
                                                            #{index + 1}
                                                        </span>
                                                        <span className={`font-bold ${isWinner ? 'text-amber-400 text-lg' : 'text-slate-200'}`}>{t.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-mono text-xl font-black text-emerald-400">{t.balance}</span>
                                                        <span className="text-xs text-slate-500">p</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="pt-4 border-t border-slate-800 grid grid-cols-2 gap-4 text-sm text-slate-400">
                                        <div>
                                            <p className="text-xs uppercase text-slate-500 font-bold mb-1">Mest framgångsrik lärare</p>
                                            <p className="text-white font-semibold">{getTopTeacher()}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase text-slate-500 font-bold mb-1">Totalt antal utmaningar</p>
                                            <p className="text-white font-semibold">{CHALLENGES.length} st</p>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={resetEntireGame}
                                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-6 py-3 rounded-xl font-semibold transition text-sm flex items-center justify-center gap-2 mx-auto"
                                >
                                    <RefreshCw size={16} />
                                    Spela igen med samma lag
                                </button>
                            </div>
                        )}

                        {/* ANSLUTNA LAG (Host-vy, syns längst ner) */}
                        {session.currentSlideIndex <= CHALLENGES.length && (
                            <div className="bg-slate-950/20 p-6 rounded-3xl border border-slate-800/80">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-md font-bold text-slate-400 flex items-center gap-2 uppercase tracking-wider text-xs">
                                        <Users size={14} />
                                        Anslutna lag ({teams.length} st)
                                    </h3>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {teams.map((t) => (
                                        <div
                                            key={t.id}
                                            className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl flex items-center gap-3 hover:border-slate-700 transition"
                                        >
                                            <span className="font-bold text-slate-200">{t.name}</span>
                                            <span className="font-mono text-emerald-400 font-bold text-sm bg-slate-950 px-2 py-0.5 rounded border border-slate-800">{t.balance}p</span>
                                        </div>
                                    ))}
                                    {teams.length === 0 && (
                                        <p className="text-sm text-slate-500 italic">Väntar på att deltagare ska ansluta...</p>
                                    )}
                                </div>
                            </div>
                        )}

                    </div>
                )}

                {/* ==========================================
            SPELARNAS GRÄNSSNITT (PLAYER)
           ========================================== */}
                {role === 'player' && session && (
                    <div className="w-full max-w-md space-y-6 animate-fadeIn">

                        {/* Registrera lag */}
                        {!myTeam && (
                            <div className="bg-slate-950/40 p-8 rounded-3xl border border-slate-800 space-y-6">
                                <div className="text-center space-y-2">
                                    <h2 className="text-2xl font-black text-white">Anslut ditt lag!</h2>
                                    <p className="text-slate-400 text-sm">Välj ett lagnamn som syns på storskärmen. Ni får 100 {CURRENCY} i startkapital. När spelet startat kan endast befintliga lagnamn återansluta.</p>
                                </div>

                                <form onSubmit={registerTeam} className="space-y-4">
                                    <div>
                                        <label className="block text-xs uppercase font-bold text-slate-400 mb-2">Lagnamn</label>
                                        <input
                                            type="text"
                                            placeholder="T.ex. Lag Snilleblixtarna"
                                            value={newTeamName}
                                            onChange={(e) => setNewTeamName(e.target.value)}
                                            maxLength={24}
                                            className="w-full bg-slate-900 border border-slate-700 px-4 py-3.5 rounded-xl text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={!newTeamName.trim()}
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-4 rounded-xl font-bold transition flex items-center justify-center gap-2 text-lg"
                                    >
                                        Gå med i spelet
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* Väntar i lobby */}
                        {myTeam && session.currentSlideIndex === 0 && (
                            <div className="bg-slate-950/40 p-8 rounded-3xl border border-slate-800 text-center space-y-6">
                                <div className="inline-flex p-4 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 animate-pulse">
                                    <Check size={32} />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-black text-white">Ditt lag är anslutet!</h3>
                                    <p className="text-emerald-400 font-bold font-mono text-lg">{myTeam.name}</p>
                                    <p className="text-slate-400 text-xs mt-2">Vänta på att spelledaren startar utmaningarna på storskärmen.</p>
                                </div>
                            </div>
                        )}

                        {/* Betting skärm */}
                        {myTeam && session.currentSlideIndex > 0 && session.currentSlideIndex <= CHALLENGES.length && (
                            <div className="space-y-4">

                                <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 flex justify-between items-center shadow-lg">
                                    <div>
                                        <span className="text-xs uppercase text-slate-500 font-bold block">Ditt saldo</span>
                                        <span className="font-mono text-2xl font-black text-emerald-400">{myTeam.balance} <span className="text-xs text-slate-400">p</span></span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs uppercase text-slate-500 font-bold block">Utskick {session.currentSlideIndex}</span>
                                        <span className="font-bold text-slate-200 truncate max-w-[150px] block">{CHALLENGES[session.currentSlideIndex - 1].title}</span>
                                    </div>
                                </div>

                                {myTeam.activeBet ? (
                                    <div className="bg-slate-950/40 p-6 rounded-2xl border border-slate-800 text-center space-y-4">
                                        <div className="inline-flex p-3 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20">
                                            <Coins size={24} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-white text-lg">Ditt bet är registrerat!</h4>
                                            <p className="text-slate-400 text-sm mt-1">
                                                Du har bettat <strong className="text-indigo-300">{myTeam.activeBet.amount} {CURRENCY}</strong> på{' '}
                                                <strong className="text-indigo-300">
                                                    {CHALLENGES[session.currentSlideIndex - 1].teachers.find(t => t.id === (myTeam.activeBet?.teacherId ?? ''))?.name}
                                                </strong>
                                            </p>
                                        </div>

                                        {session.state === 'betting' && (
                                            <button onClick={cancelBet} className="text-xs text-red-400 hover:text-red-300 underline font-semibold transition py-2">
                                                Ångra bet (och få tillbaka {CURRENCY})
                                            </button>
                                        )}

                                        <div className="pt-2 border-t border-slate-800 mt-4">
                                            {session.state === 'betting' ? (
                                                <p className="text-xs text-slate-500 italic">Väntar på att utmaningen ska avgöras på storskärmen...</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    <p className="text-sm font-bold uppercase tracking-wider text-slate-400">Resultat</p>
                                                    {session.lastWinner?.id === myTeam.activeBet.teacherId ? (
                                                        <div className="bg-emerald-950/40 text-emerald-400 border border-emerald-800/50 rounded-xl p-3 text-sm font-bold animate-bounce">
                                                            Grattis! Ni vann {Math.round(myTeam.activeBet.amount * session.lastWinner.odds)} {CURRENCY}! 🎉
                                                        </div>
                                                    ) : (
                                                        <div className="bg-red-950/40 text-red-300 border border-red-800/50 rounded-xl p-3 text-sm font-semibold">
                                                            Det blev förlust denna gång.
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    session.state === 'betting' ? (
                                        <form onSubmit={placeBet} className="bg-slate-950/40 p-6 rounded-2xl border border-slate-800 space-y-4">
                                            <h3 className="text-lg font-bold text-slate-200">Placera ert bet</h3>

                                            <div className="space-y-2">
                                                <label className="block text-xs uppercase font-bold text-slate-400">Välj kandidat</label>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {CHALLENGES[session.currentSlideIndex - 1].teachers.map((t) => (
                                                        <button
                                                            key={t.id}
                                                            type="button"
                                                            onClick={() => setSelectedTeacherId(t.id)}
                                                            className={`w-full p-3 rounded-xl text-left border flex justify-between items-center transition ${selectedTeacherId === t.id
                                                                ? 'bg-indigo-600/20 border-indigo-500 text-white'
                                                                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                                                                }`}
                                                        >
                                                            <span className="font-bold">{t.name}</span>
                                                            <span className="font-mono text-emerald-400 font-bold text-sm bg-slate-950 px-2 py-0.5 rounded border border-slate-800">{t.odds}x</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <label className="block text-xs uppercase font-bold text-slate-400">Poäng att satsa</label>
                                                </div>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max={myTeam.balance}
                                                        placeholder="Hur mycket poäng?"
                                                        value={betAmount}
                                                        onChange={(e) => setBetAmount(e.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-700 px-4 py-3 rounded-xl text-white font-medium text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setBetAmount(myTeam.balance.toString())}
                                                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 rounded-xl font-bold transition text-xs uppercase"
                                                    >
                                                        All in
                                                    </button>
                                                </div>
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={!selectedTeacherId || !betAmount}
                                                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-4 rounded-xl font-bold transition flex items-center justify-center gap-2 text-lg"
                                            >
                                                Lås vårt bet
                                            </button>
                                        </form>
                                    ) : (
                                        <div className="bg-slate-950/40 p-6 rounded-2xl border border-slate-800 text-center space-y-3">
                                            <ShieldAlert className="mx-auto text-amber-500" size={32} />
                                            <h4 className="font-bold text-white">Rundan är stängd</h4>
                                            <p className="text-xs text-slate-400">Rättningsresultaten visas på storskärmen.</p>
                                        </div>
                                    )
                                )}

                            </div>
                        )}

                        {/* Slutslide deltagarvy */}
                        {myTeam && session.currentSlideIndex > CHALLENGES.length && (
                            <div className="bg-slate-950/40 p-8 rounded-3xl border border-slate-800 text-center space-y-6">
                                <div className="inline-flex p-4 bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20">
                                    <Trophy size={36} />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-black text-white">Spelet är slut!</h3>
                                    <p className="text-slate-400 text-sm">Se er slutliga placering på storskärmen!</p>
                                </div>
                                <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 text-left space-y-1">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400 font-bold">Ditt lagnamn:</span>
                                        <strong className="text-white">{myTeam.name}</strong>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400 font-bold">Slutgiltigt saldo:</span>
                                        <strong className="font-mono text-emerald-400 text-base">{myTeam.balance} {CURRENCY}</strong>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

            </main>

            {/* FOOTER */}
            <footer className="p-4 border-t border-slate-800 text-center text-xs text-slate-500">
                <p>Byggd av team episk gnu. Sidan använder kakor, du gillar det.</p>
            </footer>

        </div>
    );
}