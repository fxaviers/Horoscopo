# Horóscopo do Dia — PWA em Português (pt-BR)

Aplicativo web progressivo (PWA) leve, acessível e *offline-first* em **Português (pt-BR)** para leitura diária, semanal e mensal do horóscopo, acompanhado de **Cor do dia**, **Número da sorte**, **Energia do dia** e da seção **Lua e Sol de Hoje** (fase lunar atual, próxima mudança da Lua, nascer/pôr do sol e duração do dia em 16 capitais brasileiras).

Construído com HTML5, CSS3 moderno e JavaScript ES Modules puros (zero build e zero dependências externas).

---

## Como funciona a atualização e tradução via GitHub Actions

As previsões vêm da API `freehoroscopeapi.com` (em inglês) e são mantidas pré-traduzidas para **pt-BR** no arquivo estático `horoscopo/data/horoscopo.json`.

### Pipeline automático (`.github/workflows/update-horoscopo.yml`)

- **Agendamento diário**: roda todos os dias às **03h15 no horário de Brasília** (`cron: '15 6 * * *'` em UTC).
- **Execução manual (`workflow_dispatch`)**: pode ser disparado a qualquer momento na aba **Actions → Atualizar Horóscopo do Dia → Run workflow** (inclusive marcando a opção `force` para retraduzir todas as 36 entradas).
- **Commit seguro na branch atual**: utiliza `permissions: contents: write`, faz `git pull --rebase` e envia alterações apenas se `horoscopo/data/horoscopo.json` tiver mudado, usando a branch dinâmica `${{ github.ref_name }}` (compatível com `master` ou `main`).

### Script de coleta e tradução blindada (`horoscopo/scripts/update-horoscopo.mjs`)

O script roda em **Node.js 20+** sem pacotes npm externos:

1. **Reaproveitamento inteligente**: lê o `horoscopo/data/horoscopo.json` anterior e reaproveita previsões válidas cuja `date` da API não mudou (ideal para `weekly` e `monthly`), a menos que a flag `--force` seja usada. Também aplica *fallback* parcial caso algum signo falhe temporariamente.
2. **Coleta resiliente**: busca os 12 signos × 3 períodos (`daily`, `weekly`, `monthly`) com timeout de 12s, até 3 tentativas com *backoff* exponencial e concorrência limitada.
3. **Cascata de tradução para pt-BR**:
   1. **Gemini Flash (opcional)**: se o *secret* `GEMINI_API_KEY` estiver configurado, traduz via REST API pedindo pt-BR natural, acolhedor e fiel ao original.
   2. **Google Translate (`client=gtx`)**: divide o texto por frases em blocos de até 900 caracteres.
   3. **MyMemory**: divide o texto por frases em blocos de até 420 caracteres (pode usar o *secret* opcional `MYMEMORY_EMAIL` no parâmetro `de=`).
4. **Validação e normalização pt-BR**: rejeita textos vazios, avisos de limite/erro, HTML ou trechos que permaneceram em inglês (avançando automaticamente para o próximo provedor da cascata) e normaliza a acentuação dos 12 signos (`Áries`, `Touro`, `Gêmeos`, `Câncer`, `Leão`, `Virgem`, `Libra`, `Escorpião`, `Sagitário`, `Capricórnio`, `Aquário`, `Peixes`).
5. **Escrita atômica**: grava primeiro em `.tmp`, valida todas as 36 entradas e só então substitui `horoscopo/data/horoscopo.json`.

### Configurando secrets opcionais no GitHub

Sem nenhuma chave configurada, o pipeline já funciona usando **Google GTX** e **MyMemory**. Caso queira traduções ainda mais naturais com **Gemini Flash**:

1. No repositório do GitHub, acesse **Settings → Secrets and variables → Actions**.
2. Clique em **New repository secret**.
3. Crie `GEMINI_API_KEY` com sua chave da API do Google AI Studio (opcional).
4. Opcionalmente, crie `MYMEMORY_EMAIL` com um e-mail válido para ampliar a cota gratuita do provedor MyMemory.

### Executando localmente

```bash
# Atualiza apenas previsões cuja data mudou na API
node horoscopo/scripts/update-horoscopo.mjs

# Força nova tradução de todas as 36 previsões (12 signos × 3 períodos)
node horoscopo/scripts/update-horoscopo.mjs --force
```

---

## Como hospedar no GitHub Pages

O aplicativo fica em `horoscopo/` usando caminhos relativos (`./`) e o repositório já inclui `.nojekyll` na raiz.

1. Envie o repositório para o GitHub (na branch padrão, como `master`).
2. Acesse **Settings → Pages**.
3. Em **Build and deployment**, escolha **Deploy from a branch**, selecione a branch do repositório (`master`, pasta `/ (root)`) e clique em **Save**.
4. Em **Settings → Actions → General**, verifique em *Workflow permissions* que o Actions tem permissão de leitura e escrita (ou mantenha `contents: write` definido no workflow) para que as atualizações diárias de `horoscopo/data/horoscopo.json` sejam gravadas automaticamente.
5. Após a publicação, o aplicativo ficará acessível em HTTPS no endereço:

   `https://<seu-usuario>.github.io/<seu-repositorio>/horoscopo/`

---

## Como instalar no celular Android

1. Abra o **Google Chrome** no celular Android e acesse o link HTTPS do aplicativo (`.../horoscopo/`).
2. Toque no botão **Instalar** na barra superior do aplicativo (quando disponível) **ou** toque no menu do Chrome (`⋮`, no canto superior direito) e escolha **Instalar aplicativo** / **Adicionar à tela inicial**.
3. Confirme a instalação. O ícone **Horóscopo** aparecerá na tela inicial do celular, abrindo em modo aplicativo sem barras do navegador e funcionando mesmo sem internet com a última previsão salva e os cálculos astronômicos locais da Lua e do Sol.
