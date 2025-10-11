# Aluguel de Bicicletas — Eventos (Socket.IO + React)

Sistema didático de **aluguel/devolução de bicicletas** com **comunicação em tempo real** entre *backend* (Node/Express/Socket.IO) e *frontend* (React + TypeScript).  
Suporta dois perfis: **Administrador** (abre/fecha sistema/estações) e **Participante** (retira/devolve bicicletas).

> Repositório: `https://github.com/JeanKoerich/aluguel-bicicleta-eventos.git`

## Índice
- [Visão Geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Eventos do Sistema](#eventos-do-sistema)
- [Perfis de Usuário](#perfis-de-usuário)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Instalação e Execução](#instalação-e-execução)
- [Como Usar](#como-usar)
- [Estrutura de Pastas](#estrutura-de-pastas)
- [Imagens / Ícones](#imagens--ícones)
- [Logs e Erros](#logs-e-erros)
- [Dicas / Solução de Problemas](#dicas--solução-de-problemas)
- [Próximos Passos](#próximos-passos)
- [Créditos](#créditos)
- [Licença](#licença)

---

## Visão Geral
O projeto demonstra um **modelo dirigido por eventos** usando WebSockets.  
Sempre que o estado muda no servidor (ex.: abrir estação, retirar bicicleta), todos os clientes conectados recebem atualização instantânea.

**Principais recursos**
- Abrir/fechar o **sistema** (global) — *admin*.
- Abrir/fechar **estações** — *admin*.
- **Retirar** bicicletas disponíveis — *participante*.
- **Devolver** bicicletas em estações com vaga — *participante*.
- Alertas de **estação lotada**.
- **Logs estruturados** no backend e emissão de **erros** legíveis para o frontend.

---

## Arquitetura
- **Backend**: Node.js + Express + Socket.IO  
  Mantém o **estado em memória** (estações, bicicletas, locações ativas) e expõe eventos Socket.IO.
- **Frontend**: React + TypeScript + socket.io-client  
  Interface simples para administrar sistema/estações e alugar/devolver bicicletas.

**Portas padrão**
- Backend: `http://localhost:4000`
- Frontend: `http://localhost:3000`

---

## Eventos do Sistema

### Emitidos pelo **frontend** → ouvidos pelo **backend**
- `sistema.toggle` — alterna aberto/fechado (somente admin)
- `estacao.aberta` `{ estacaoId, aberta }` — abre/fecha estação (somente admin)
- `bicicleta.retirada` `{ estacaoId, bicicletaId }` — retira bike (participante)
- `bicicleta.devolvida` `{ estacaoId, bicicletaId }` — devolve bike (participante)

### Emitidos pelo **backend** → ouvidos pelo **frontend**
- `estadoInicial` — estado completo no ato da conexão
- `estadoAltera` — broadcast quando qualquer estado muda
- `estacao.lotada` `{ estacaoId, timestamp }` — notificação quando vagas chegam a zero
- `erro` `{ code, message, ... }` — feedback de erro (ex.: sem vaga, estação fechada, sem permissão)

---

## Perfis de Usuário
- **Administrador**
  - Abre/fecha o **sistema**.
  - Abre/fecha **estações**.
- **Participante**
  - **Retira** bicicletas disponíveis em estações abertas.
  - **Devolve** bicicletas onde há vaga.

> O usuário é selecionado no frontend (combobox). O `userId` é enviado no `handshake` do Socket.IO.

---

## Tecnologias Utilizadas
- **Backend**: Node.js, Express, Socket.IO, TypeScript, CORS
- **Frontend**: React, TypeScript, socket.io-client
- (Opcional) Nodemon para *hot reload* do backend em dev

---

## Instalação e Execução

### 1) Clonar o repositório
```bash
git clone https://github.com/JeanKoerich/aluguel-bicicleta-eventos.git
cd aluguel-bicicleta-eventos
```

### 2) Backend
```bash
cd backend
npm install
# desenvolvimento (se tiver script start ou dev)
npm start
# ou
npm run dev
```
> O backend sobe em `http://localhost:4000`.

### 3) Frontend
Em outro terminal:
```bash
cd frontend
npm install
npm start
```
> O frontend sobe em `http://localhost:3000`.

---

## Como Usar
1. No **frontend**, escolha o **usuário** (Admin ou Participante).
2. Como **Admin**:
   - Abra o **sistema** (card “Sistema”).
   - Abra/feche **estações** (em cada card de estação).
3. Como **Participante**:
   - Com sistema e estação **abertos**, clique em **Retirar** em uma bicicleta disponível.
   - Para **devolver**, selecione sua bike no seletor da estação desejada e clique **Devolver aqui**.
4. Repare nos **ícones**:
   - Estação aberta/fechada muda o ícone.
   - Bicicleta disponível/alugada muda o ícone.

---

## Estrutura de Pastas
```
aluguel-bicicleta-eventos/
├─ backend/
│  ├─ src/
│  │  └─ server.ts         # Servidor Express + Socket.IO, estado e eventos
│  ├─ package.json
│  └─ tsconfig.json
├─ frontend/
│  ├─ public/
│  │  └─ images/           # Ícones: usuario.png, estacaoOn.png, estacaoOff.png, bicicletaOn.png, bicicletaOff.png
│  ├─ src/
│  │  ├─ App.tsx           # UI principal e conexão socket
│  │  └─ App.css           # Estilos
│  ├─ package.json
│  └─ tsconfig.json
└─ README.md
```

---

## Imagens / Ícones
Coloque os arquivos em `frontend/public/images`:
- `usuario.png`
- `estacaoOn.png`
- `estacaoOff.png`
- `bicicletaOn.png`
- `bicicletaOff.png`

No código, são referenciados como:  
`/images/usuario.png`, `/images/estacaoOn.png`, etc.

---

## Logs e Erros
- O backend registra logs estruturados com timestamp (INFO/WARN/ERROR).
- Em caso de falhas/validações, o backend emite `erro` para o cliente:
  ```json
  { "code": "NO_SPACE", "message": "Estação sem vagas.", "estacaoId": "E01" }
  ```
- O frontend escuta este evento e pode exibir `alert()` ou toast.

---

## Dicas / Solução de Problemas
- **“npm start: Missing script ‘start’”**  
  Adicione o script no `package.json`:
  ```json
  // backend/package.json
  "scripts": { "start": "ts-node src/server.ts", "dev": "nodemon src/server.ts" }

  // frontend/package.json
  "scripts": { "start": "react-scripts start" }
  ```
- **CORS/Conexão recusada**  
  Confirme as portas: backend `4000`, frontend `3000`.  
  E no backend: `cors: { origin: "http://localhost:3000" }`.
- **socket.io-client**  
  Use versão compatível com a do servidor (ex.: `^4.x`).
- **Ícones não aparecem**  
  Verifique se os arquivos estão em `public/images` e os nomes batem.

---

## Próximos Passos
- Persistência (ex.: banco ou arquivo) em vez de estado em memória.
- Tela/lista de **alertas** (ex.: estações lotadas).
- **Autenticação real** e permissões.
- Testes automatizados (unitários e de integração).
- Deploy (Railway/Render/Heroku + Vercel/Netlify).

---

## Créditos
Projeto acadêmico desenvolvido por **Jean Koerich**.  
Baseado em um modelo de eventos com Socket.IO para disciplina de Linguagens de Programação e Paradigmas.

---

## Licença
Este projeto é distribuído sob a licença MIT.  
Sinta-se à vontade para forkar, estudar e adaptar.
