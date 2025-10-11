// ============================ IMPORTS E SETUP BÁSICO ============================
// Express: app HTTP. http: servidor base. Socket.IO: tempo real. CORS: liberar front-end.
import express from "express";
import http from "http";
import { Server, Socket, DefaultEventsMap } from "socket.io";
import cors from "cors";

const app = express();
// Libera requisições de outras origens (front em outra porta).
app.use(cors());

// Cria servidor HTTP a partir do Express.
const server = http.createServer(app);

// Instancia o Socket.IO no mesmo servidor, com CORS do front.
const io = new Server(server, {
    cors: { origin: "http://localhost:3000", methods: ["GET", "POST"] },
});


// ============================ HELPERS DE LOG ============================
// Padroniza logs e erros enviados ao cliente.

type LogCtx = Record<string, unknown> | undefined;

const TS = () => new Date().toISOString();
const j = (obj: unknown) => {
    try { return JSON.stringify(obj); } catch { return String(obj); }
};

function logInfo(msg: string, ctx?: LogCtx) {
    console.log(`[INFO] ${TS()} ${msg}${ctx ? " " + j(ctx) : ""}`);
}
function logWarn(msg: string, ctx?: LogCtx) {
    console.warn(`[WARN] ${TS()} ${msg}${ctx ? " " + j(ctx) : ""}`);
}
function logError(msg: string, err?: unknown, ctx?: LogCtx) {
    console.error(
        `[ERROR] ${TS()} ${msg}${ctx ? " " + j(ctx) : ""}\n→ ${err instanceof Error ? err.stack || err.message : j(err)}`
    );
}

// Envia um erro para o cliente e registra no log.
function emitError(socket: Socket, code: string, message: string, extra?: LogCtx) {
    socket.emit("erro", { code, message, ...extra });
    logWarn(`emitError ${code}: ${message}`, extra);
}

// Emite o novo estado para todos e loga a ação.
function broadcastEstado() {
    io.emit("estadoAltera", entidades);
    logInfo("Broadcast estadoAltera");
}


// ============================ ESTADO INICIAL E TIPOS ============================
// Tipos para garantir formato dos dados (TS) e estado em memória (protótipo simples).

type Usuario = {
    nome: string;
    funcao: "administrador" | "participante";
};

type Bike = {
    status: "disponivel" | "alugada";
    estacaoId: string | null;
    emUsoPor: string | null;
};

type Estacao = {
    nome: string;
    capacidade: number;
    espacoLivre: number;
    aberta: boolean;
    bicicletasDisponiveis: string[];
    lotada: boolean;
};

let entidades: {
    sistema: { aberto: boolean; horarioUltimaAbertura: string | null };
    estacao: Record<string, Estacao>;
    bicicletas: Record<string, Bike>;
    usuarios: Record<string, Usuario>;
    locacoesAtivas: Record<string, { usuarioId: string; inicioISO: string }>;
} = {
    // Controle global (se o sistema aceita/nega operações).
    sistema: { aberto: false, horarioUltimaAbertura: null },

    // Duas estações de exemplo com suas bikes presentes.
    estacao: {
        E01: {
            nome: "Centro",
            capacidade: 10,
            espacoLivre: 2,
            aberta: false,
            bicicletasDisponiveis: ["B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08"],
            lotada: false,
        },
        E02: {
            nome: "Avenida",
            capacidade: 20,
            espacoLivre: 5,
            aberta: false,
            bicicletasDisponiveis: [
                "B11", "B12", "B13", "B14", "B15", "B16", "B17", "B18", "B19", "B20",
                "B21", "B22", "B23", "B24", "B25",
            ],
            lotada: false,
        },
    },

    // Bikes com status inicial e vínculo de estação.
    bicicletas: {
        B01: { status: "disponivel", estacaoId: "E01", emUsoPor: null },
        B02: { status: "disponivel", estacaoId: "E01", emUsoPor: null },
        B03: { status: "disponivel", estacaoId: "E01", emUsoPor: null },
        B04: { status: "disponivel", estacaoId: "E01", emUsoPor: null },
        B05: { status: "disponivel", estacaoId: "E01", emUsoPor: null },
        B06: { status: "disponivel", estacaoId: "E01", emUsoPor: null },
        B07: { status: "disponivel", estacaoId: "E01", emUsoPor: null },
        B08: { status: "disponivel", estacaoId: "E01", emUsoPor: null },
        B09: { status: "disponivel", estacaoId: "E01", emUsoPor: null },
        B10: { status: "disponivel", estacaoId: "E01", emUsoPor: null },

        B11: { status: "disponivel", estacaoId: "E02", emUsoPor: null },
        B12: { status: "disponivel", estacaoId: "E02", emUsoPor: null },
        B13: { status: "disponivel", estacaoId: "E02", emUsoPor: null },
        B14: { status: "disponivel", estacaoId: "E02", emUsoPor: null },
        B15: { status: "disponivel", estacaoId: "E02", emUsoPor: null },
        B16: { status: "disponivel", estacaoId: "E02", emUsoPor: null },
        B17: { status: "disponivel", estacaoId: "E02", emUsoPor: null },
        B18: { status: "disponivel", estacaoId: "E02", emUsoPor: null },
        B19: { status: "disponivel", estacaoId: "E02", emUsoPor: null },
        B20: { status: "disponivel", estacaoId: "E02", emUsoPor: null },
        B21: { status: "disponivel", estacaoId: "E02", emUsoPor: null },
        B22: { status: "disponivel", estacaoId: "E02", emUsoPor: null },
        B23: { status: "disponivel", estacaoId: "E02", emUsoPor: null },
        B24: { status: "disponivel", estacaoId: "E02", emUsoPor: null },
        B25: { status: "disponivel", estacaoId: "E02", emUsoPor: null },
    },

    // Usuários de exemplo: 1 admin e 2 participantes.
    usuarios: {
        "U-ADM-1": { nome: "Admin", funcao: "administrador" },
        "U-001": { nome: "Jean", funcao: "participante" },
        "U-002": { nome: "Maria", funcao: "participante" },
    },

    // Locações em andamento (não é histórico).
    locacoesAtivas: {},
};


// ============================ HELPERS DE NEGÓCIO ============================
// Pequenas funções utilitárias usadas em vários pontos.

const nowISO = () => new Date().toISOString();

// Recalcula vagas e lotação da estação; emite evento se lotar.
function recomputaEstacao(estacaoId: string) {
    const e = entidades.estacao[estacaoId];
    if (!e) return;
    e.espacoLivre = Math.max(e.capacidade - e.bicicletasDisponiveis.length, 0);
    e.lotada = e.espacoLivre === 0;
    if (e.lotada) {
        io.emit("estacao.lotada", { estacaoId, timestamp: nowISO() });
        logInfo("Evento estacao.lotada emitido", { estacaoId });
    }
}

// Pega o usuário do socket via handshake (auth.userId).
function getUsuario(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>
) {
    const userId = socket.handshake.auth?.userId as string | undefined;
    if (!userId) return null;
    const base = entidades.usuarios[userId];
    if (!base) return null;
    return { id: userId, ...base };
}

// Verifica se o usuário do socket é administrador.
function assertAdmin(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>
) {
    const u = getUsuario(socket);
    return !!u && u.funcao === "administrador";
}


// ============================ EVENTOS SOCKET.IO ============================
// Conexão, regras de negócio (retirar/devolver/abrir/fechar), logs e erros.

io.on("connection", (socket) => {
    try {
        const u = getUsuario(socket);
        logInfo("Cliente conectado", { socketId: socket.id, userId: u?.id, funcao: u?.funcao });

        // Envia o estado completo assim que conecta (render inicial no front).
        socket.emit("estadoInicial", entidades);
        logInfo("estadoInicial enviado", { socketId: socket.id });
    } catch (err) {
        logError("Falha ao enviar estadoInicial", err, { socketId: socket.id });
        emitError(socket, "INIT_FAIL", "Falha ao carregar estado inicial.");
    }

    // --------- ADMIN: liga/desliga o sistema ---------
    socket.on("sistema.toggle", () => {
        try {
            if (!assertAdmin(socket)) {
                emitError(socket, "FORBIDDEN", "Ação restrita a administradores.");
                return;
            }
            entidades.sistema.aberto = !entidades.sistema.aberto;
            if (entidades.sistema.aberto) {
                entidades.sistema.horarioUltimaAbertura = nowISO();
            }
            logInfo("sistema.toggle", { aberto: entidades.sistema.aberto });
            broadcastEstado();
        } catch (err) {
            logError("Erro em sistema.toggle", err);
            emitError(socket, "SYS_TOGGLE_ERROR", "Não foi possível alternar o sistema.");
        }
    });

    // --------- ADMIN: abre/fecha uma estação ---------
    socket.on("estacao.aberta", ({ estacaoId, aberta }: { estacaoId: string; aberta: boolean }) => {
        try {
            if (!assertAdmin(socket)) {
                emitError(socket, "FORBIDDEN", "Ação restrita a administradores.");
                return;
            }
            const est = entidades.estacao[estacaoId];
            if (!est) {
                emitError(socket, "NOT_FOUND", "Estação inexistente.", { estacaoId });
                return;
            }

            est.aberta = !!aberta;
            // Convenção: abrir estação também assegura o sistema aberto.
            if (aberta) {
                entidades.sistema.aberto = true;
                entidades.sistema.horarioUltimaAbertura = nowISO();
            }
            recomputaEstacao(estacaoId);
            logInfo("estacao.aberta", { estacaoId, aberta: est.aberta });
            broadcastEstado();
        } catch (err) {
            logError("Erro em estacao.aberta", err, { estacaoId, aberta });
            emitError(socket, "STATION_TOGGLE_ERROR", "Não foi possível alterar a estação.", { estacaoId });
        }
    });

    // --------- PARTICIPANTE: retirar bike ---------
    socket.on("bicicleta.retirada", ({ estacaoId, bicicletaId }: { estacaoId: string; bicicletaId: string }) => {
        try {
            const user = getUsuario(socket);
            if (!user) {
                emitError(socket, "UNAUTHORIZED", "Usuário não identificado.");
                return;
            }
            if (!entidades.sistema.aberto) {
                emitError(socket, "CLOSED", "Sistema fechado.");
                return;
            }

            const est = entidades.estacao[estacaoId];
            const bike = entidades.bicicletas[bicicletaId];
            if (!est?.aberta) {
                emitError(socket, "STATION_CLOSED", "Estação fechada.", { estacaoId });
                return;
            }
            if (!bike) {
                emitError(socket, "NOT_FOUND", "Bicicleta inexistente.", { bicicletaId });
                return;
            }

            const presente = est.bicicletasDisponiveis.includes(bicicletaId);
            const disponivel = bike.status === "disponivel";
            if (!presente || !disponivel) {
                emitError(socket, "NOT_AVAILABLE", "Bicicleta não disponível nesta estação.", { estacaoId, bicicletaId });
                return;
            }

            // Transições de estado (remover da estação e marcar como alugada)
            est.bicicletasDisponiveis = est.bicicletasDisponiveis.filter((id) => id !== bicicletaId);
            bike.status = "alugada";
            bike.estacaoId = null;
            bike.emUsoPor = user.id;

            // Registra locação ativa (somente as em andamento).
            entidades.locacoesAtivas[bicicletaId] = { usuarioId: user.id, inicioISO: nowISO() };

            recomputaEstacao(estacaoId);
            logInfo("bicicleta.retirada", { userId: user.id, estacaoId, bicicletaId });
            broadcastEstado();
        } catch (err) {
            logError("Erro em bicicleta.retirada", err, { estacaoId, bicicletaId });
            emitError(socket, "RENT_ERROR", "Não foi possível retirar a bicicleta.", { estacaoId, bicicletaId });
        }
    });

    // --------- PARTICIPANTE: devolver bike ---------
    socket.on("bicicleta.devolvida", ({ estacaoId, bicicletaId }: { estacaoId: string; bicicletaId: string }) => {
        try {
            const user = getUsuario(socket);
            if (!user) {
                emitError(socket, "UNAUTHORIZED", "Usuário não identificado.");
                return;
            }

            const est = entidades.estacao[estacaoId];
            const bike = entidades.bicicletas[bicicletaId];
            if (!est?.aberta) {
                emitError(socket, "STATION_CLOSED", "Estação fechada.", { estacaoId });
                return;
            }
            if (!bike) {
                emitError(socket, "NOT_FOUND", "Bicicleta inexistente.", { bicicletaId });
                return;
            }

            // Só quem alugou pode devolver.
            const corretaPessoa = bike.status === "alugada" && bike.emUsoPor === user.id;
            if (!corretaPessoa) {
                emitError(socket, "NOT_OWNER", "Você não está com esta bicicleta.", { bicicletaId });
                return;
            }
            // Precisa ter vaga na estação.
            if (est.espacoLivre <= 0) {
                emitError(socket, "NO_SPACE", "Estação sem vagas.", { estacaoId });
                return;
            }

            // Transições de estado (volta para a estação e libera a bike)
            est.bicicletasDisponiveis.push(bicicletaId);
            bike.status = "disponivel";
            bike.estacaoId = estacaoId;
            bike.emUsoPor = null;

            // Remove a locação ativa (terminou o uso).
            delete entidades.locacoesAtivas[bicicletaId];

            recomputaEstacao(estacaoId);
            logInfo("bicicleta.devolvida", { userId: user.id, estacaoId, bicicletaId });
            broadcastEstado();
        } catch (err) {
            logError("Erro em bicicleta.devolvida", err, { estacaoId, bicicletaId });
            emitError(socket, "RETURN_ERROR", "Não foi possível devolver a bicicleta.", { estacaoId, bicicletaId });
        }
    });

    // Log simples ao desconectar (debug).
    socket.on("disconnect", () => {
        logInfo("Cliente desconectado", { socketId: socket.id });
    });
});

// ============================ SUBIDA DO SERVIDOR ============================
// Inicia o servidor HTTP + Socket.IO na porta 4000.
const PORT = 4000;
server.listen(PORT, () => {
    logInfo(`Servidor rodando na porta ${PORT}`);
});