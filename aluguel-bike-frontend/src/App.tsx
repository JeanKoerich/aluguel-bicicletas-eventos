// ============================ IMPORTS E SETUP ============================
// React, socket.io-client para tempo real, e CSS externo da UI.
import React, { useEffect, useState } from "react";
import io, { Socket } from "socket.io-client";
import "./App.css";

// ============================ ÍCONES ============================
// Caminhos estáticos em /public/images (acessados por /images/…)
const ICONS = {
  user: "/images/usuario.png",
  estacaoOn: "/images/estacaoOn.png",
  estacaoOff: "/images/estacaoOff.png",
  bikeOn: "/images/bicicletaOn.png",
  bikeOff: "/images/bicicletaOff.png",
};

// Escolhe ícone da estação conforme aberta/fechada
function stationIcon(est: { aberta: boolean }) {
  return est.aberta ? ICONS.estacaoOn : ICONS.estacaoOff;
}

// Escolhe ícone da bike conforme status
function bikeIcon(status?: "disponivel" | "alugada") {
  return status === "disponivel" ? ICONS.bikeOn : ICONS.bikeOff;
}

// ============================ TIPOS (TS) ============================
// Tipos mínimos para garantir consistência com o servidor.
type Funcao = "administrador" | "participante";
type UsuarioId = "U-ADM-1" | "U-001" | "U-002";
type Estacao = {
  nome: string; capacidade: number; espacoLivre: number; aberta: boolean;
  bicicletasDisponiveis: string[]; lotada: boolean;
};
type Bike = { status: "disponivel" | "alugada"; estacaoId: string | null; emUsoPor: string | null };
type Estado = {
  sistema: { aberto: boolean; horarioUltimaAbertura: string | null };
  estacao: Record<string, Estacao>;
  bicicletas: Record<string, Bike>;
  usuarios: Record<string, { nome: string; funcao: Funcao }>;
  locacoesAtivas: Record<string, { usuarioId: string; inicioISO: string }>;
};

// URL do servidor Socket.IO (backend)
const SOCKET_URL = "http://localhost:4000";

// ============================ APP ============================
const App: React.FC = () => {
  // Estado global que vem do servidor
  const [estado, setEstado] = useState<Estado | null>(null);
  // Usuário “logado” (simples via select)
  const [userId, setUserId] = useState<UsuarioId>("U-001");
  // Referência do socket para emitir eventos
  const [socket, setSocket] = useState<Socket | null>(null);

  // Conecta/desconecta ao trocar usuário; assina os eventos do servidor
  useEffect(() => {
    const s = io(SOCKET_URL, { auth: { userId } }); // manda userId no handshake
    setSocket(s);
    s.on("estadoInicial", (e: Estado) => setEstado(e)); // 1º snapshot
    s.on("estadoAltera", (e: Estado) => setEstado(e)); // updates broadcast
    // (Opcional) ouvir erros vindos do servidor
    s.on("erro", (err: any) => {
      console.warn("Erro do servidor:", err);
      alert(err?.message ?? "Ocorreu um erro.");
    });
    // cleanup ao desmontar/trocar user
    return () => { s.off("estadoInicial"); s.off("estadoAltera"); s.off("erro"); s.disconnect(); };
  }, [userId]);

  // Loading inicial
  if (!estado) return <div className="app">Conectando…</div>;

  // Derivados do estado para a UI
  const usuarioAtual = { id: userId, ...estado.usuarios[userId] };
  const isAdmin = usuarioAtual.funcao === "administrador";

  // ============================ AÇÕES (EMITEM PARA O SERVIDOR) ============================
  const toggleSistema = () => socket?.emit("sistema.toggle");
  const toggleEstacao = (estacaoId: string, aberta: boolean) =>
    socket?.emit("estacao.aberta", { estacaoId, aberta });
  const retirar = (estacaoId: string, bicicletaId: string) =>
    socket?.emit("bicicleta.retirada", { estacaoId, bicicletaId });
  const devolver = (estacaoId: string, bicicletaId: string) =>
    socket?.emit("bicicleta.devolvida", { estacaoId, bicicletaId });

  // Bikes que o usuário atual está usando (chips no topo)
  const minhasBikes = Object.entries(estado.bicicletas)
    .filter(([_, b]) => b.status === "alugada" && b.emUsoPor === usuarioAtual.id)
    .map(([id]) => id);

  // ============================ UI ============================
  return (
    <div className="app">
      {/* Título + ícone de usuário */}
      <h1 className="h1">
        <img src={ICONS.user} width={28} height={28} alt="Usuário" />
        Aluguel de Bicicletas
      </h1>

      {/* Barra de usuário: troca de perfil e exibição da função */}
      <div className="userbar">
        <label>
          Usuário:&nbsp;
          <select value={userId} onChange={(e) => setUserId(e.target.value as UsuarioId)}>
            <option value="U-ADM-1">U-ADM-1 (Admin)</option>
            <option value="U-001">U-001 (Jean)</option>
            <option value="U-002">U-002 (Maria)</option>
          </select>
        </label>
        <small>Função: <b>{usuarioAtual.funcao}</b></small>
      </div>

      {/* Cartão do sistema (status global e botão do admin) */}
      <div className="card">
        <h3 className="h3">
          <img src={stationIcon({ aberta: estado.sistema.aberto })} width={22} height={22} alt="Status sistema" />
          Sistema
        </h3>
        <p>
          Status:{" "}
          <b className={estado.sistema.aberto ? "text-ok" : "text-muted"}>
            {estado.sistema.aberto ? "ABERTO" : "FECHADO"}
          </b>
        </p>
        <p>
          Última abertura:{" "}
          {estado.sistema.horarioUltimaAbertura
            ? new Date(estado.sistema.horarioUltimaAbertura).toLocaleString()
            : "—"}
        </p>
        {isAdmin && (
          <button onClick={toggleSistema}>
            {estado.sistema.aberto ? "Fechar sistema" : "Abrir sistema"}
          </button>
        )}
      </div>

      {/* Cartão das minhas bikes (somente participante) */}
      {usuarioAtual.funcao === "participante" && (
        <div className="card">
          <h3 className="h3">Minhas bicicletas</h3>
          <p>
            {minhasBikes.length ? (
              <>
                {minhasBikes.map((id) => {
                  const status = estado.bicicletas[id]?.status;
                  return (
                    <span key={id} className="bike-chip">
                      <img src={bikeIcon(status)} width={18} height={18} alt="" />
                      {id}
                    </span>
                  );
                })}
              </>
            ) : "Nenhuma bicicleta em uso."}
          </p>
        </div>
      )}

      {/* Lista de estações com ações e bikes disponíveis */}
      <h2>Estações</h2>
      <div className="grid">
        {Object.entries(estado.estacao).map(([estacaoId, est]) => (
          <div key={estacaoId} className="station-card">
            <h3 className="h3">
              <img src={stationIcon(est)} width={22} height={22} alt="Estação" />
              {est.nome} <span className="muted">({estacaoId})</span>
            </h3>
            <p>Capacidade: <b>{est.capacidade}</b></p>
            <p>
              Vagas livres:{" "}
              <b className={est.espacoLivre > 0 ? "text-ok" : "text-warn"}>{est.espacoLivre}</b>
            </p>
            <p>
              Situação:{" "}
              <b className={est.aberta ? (est.lotada ? "text-warn" : "text-ok") : "text-muted"}>
                {est.aberta ? (est.lotada ? "ABERTA • LOTADA" : "ABERTA") : "FECHADA"}
              </b>
            </p>

            {/* Botão de abrir/fechar estação (admin) */}
            {isAdmin && (
              <button onClick={() => toggleEstacao(estacaoId, !est.aberta)} className="mb-8">
                {est.aberta ? "Fechar estação" : "Abrir estação"}
              </button>
            )}

            <hr />

            {/* Bikes disponíveis para retirada */}
            <p className="bikes-title">Bicicletas disponíveis:</p>
            {est.bicicletasDisponiveis.length === 0 ? (
              <p className="text-muted">Nenhuma.</p>
            ) : (
              <ul className="bikes-list">
                {est.bicicletasDisponiveis.map((bikeId) => {
                  const status = estado.bicicletas[bikeId]?.status;
                  return (
                    <li key={bikeId} className="bike-item">
                      <img src={bikeIcon(status)} width={18} height={18} alt="" />
                      {bikeId}
                      {/* Participante só pode retirar se sistema e estação estiverem abertos */}
                      {usuarioAtual.funcao === "participante" &&
                        estado.sistema.aberto &&
                        est.aberta && (
                          <button onClick={() => retirar(estacaoId, bikeId)} className="ml-8">
                            Retirar
                          </button>
                        )}
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Área para devolver bike nesta estação (se o usuário tem bikes) */}
            {usuarioAtual.funcao === "participante" && minhasBikes.length > 0 && (
              <div className="return-row">
                <select id={`sel-${estacaoId}`} defaultValue="">
                  <option value="" disabled>Minha bike…</option>
                  {minhasBikes.map((id) => <option key={id} value={id}>{id}</option>)}
                </select>
                <button
                  disabled={!est.aberta || est.espacoLivre <= 0}
                  onClick={() => {
                    const sel = document.getElementById(`sel-${estacaoId}`) as HTMLSelectElement | null;
                    if (sel && sel.value) devolver(estacaoId, sel.value);
                  }}
                >
                  <img
                    src={est.aberta && est.espacoLivre > 0 ? ICONS.bikeOn : ICONS.bikeOff}
                    width={16} height={16} alt=""
                  />
                  Devolver aqui
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Rodapé simples */}
      <p className="footer">* Desenvolvido por Jean Koerich.</p>
    </div>
  );
};

export default App;
