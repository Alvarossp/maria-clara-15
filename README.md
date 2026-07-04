# Maria Clara 15 — Filtro Comemorativo (PWA)

Web App de câmera com moldura decorativa animada para os 15 anos de Maria Clara. Acessado via QR Code durante a festa, funciona como um "filtro de Instagram" — mas é um site instalável (PWA), sem dependência de nenhuma rede social.

## Estrutura do projeto

```
/
├── index.html          → telas: carregamento, permissão, câmera, resultado, modal
├── style.css           → identidade visual (azul bebê + pêssego + dourado)
├── script.js           → câmera, composição em Canvas, captura, share/download
├── manifest.json        → configuração do PWA (ícones, cores, modo standalone)
├── sw.js                → Service Worker (cache offline)
├── generate_icons.py    → script usado para gerar os ícones (não é necessário em produção)
└── assets/
    ├── svg/
    │   ├── brasao-mc.svg
    │   ├── flor-01.svg
    │   ├── flor-02.svg
    │   ├── balao-01.svg
    │   └── balao-02.svg
    └── icons/
        ├── icon-72.png ... icon-512.png
        └── icon-maskable-192.png / icon-maskable-512.png
```

## Requisitos

- Navegador com suporte a `getUserMedia`, Canvas e Service Worker (Chrome, Safari iOS 15+, Firefox, Samsung Internet).
- **HTTPS obrigatório** — câmera só funciona em contexto seguro (GitHub Pages já serve em HTTPS por padrão).

## Publicando no GitHub Pages

### 1. Criar o repositório

```bash
git init
git add .
git commit -m "Maria Clara 15 — versão inicial"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/maria-clara-15.git
git push -u origin main
```

### 2. Ativar o GitHub Pages

1. No GitHub, abra o repositório → **Settings** → **Pages**.
2. Em **Build and deployment → Source**, selecione **Deploy from a branch**.
3. Em **Branch**, selecione `main` e a pasta `/ (root)`.
4. Clique em **Save**.
5. Aguarde 1–2 minutos. O link ficará assim:
   ```
   https://SEU_USUARIO.github.io/maria-clara-15/
   ```

### 3. Ajustar caminhos (importante)

Como o GitHub Pages publica o projeto em um subcaminho (`/maria-clara-15/`), confirme que:

- `manifest.json` usa caminhos relativos (`./index.html`, `./`) — **já configurado**.
- `sw.js` usa caminhos relativos (`./style.css`, `./script.js` etc.) — **já configurado**.
- Não é necessário alterar nada se você não renomear a pasta de assets.

Se preferir um dOmínio próprio (ex. `festamariaclara.com`), adicione um arquivo `CNAME` na raiz do projeto contendo apenas o domínio, e configure o DNS conforme a documentação do GitHub Pages.

### 4. Gerar o QR Code

Depois que o link estiver no ar, gere o QR Code apontando para a URL do GitHub Pages (ex. usando `https://api.qrserver.com/v1/create-qr-code/?data=SUA_URL` ou qualquer gerador de sua preferência) e inclua-o nos convites/placas da festa.

## Testando localmente antes de publicar

Não abra o `index.html` direto pelo navegador (`file://`) — a câmera e o Service Worker não funcionam sem servidor. Use um servidor local simples:

```bash
# Opção 1 — Python
python3 -m http.server 8080

# Opção 2 — Node.js
npx serve .
```

Depois acesse `http://localhost:8080` no celular (mesma rede Wi-Fi) ou use `http://SEU_IP_LOCAL:8080`. Para testar a câmera pelo celular sem HTTPS, use um túnel como [ngrok](https://ngrok.com) ou o recurso de **port forwarding** do Chrome DevTools (`chrome://inspect`).

## Checklist antes da festa

- [ ] Testar em pelo menos um iPhone (Safari) e um Android (Chrome)
- [ ] Testar em rede móvel (4G/5G), não só Wi-Fi
- [ ] Confirmar que o download da foto funciona e salva na galeria
- [ ] Confirmar que o compartilhamento abre o menu nativo (WhatsApp, Instagram etc.)
- [ ] Imprimir o QR Code em tamanho legível (mínimo 4×4 cm)
- [ ] Deixar 2–3 celulares "de reserva" com o link salvo, caso algum convidado tenha dificuldade

## Suporte técnico

Em caso de tela branca ou erro de câmera:
1. Verifique se o link está em HTTPS.
2. Verifique se o navegador tem permissão de câmera nas configurações do sistema.
3. Force o recarregamento (pull-to-refresh) para buscar a versão mais recente do Service Worker.
