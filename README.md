# Estoura Balões

> Mire, atire e junte três ou mais bolhas da mesma cor no estilo dos clássicos de bolhas, com teto que desce a cada rodada. Ideal pra ativações de marca e totens.

**Ver ao vivo, com preview e manual:** https://flowcoresolucoes.com.br/codigos/game-estoura-baloes

Criado por **FlowCore Soluções LTDA**.

## Como jogar

- `Mouse` mirar e clicar para atirar
- `←` `→` girar a mira
- `Espaço` atirar
- `C` trocar a bolha
- `P` pausar
- **No celular:** Arraste o dedo para mirar e solte para atirar.

## Arquivos

- [`src/EstouraBaloes.tsx`](src/EstouraBaloes.tsx)

## Como instalar

1. **Tenha um projeto React com Tailwind** Já tem (Vite, Next.js, Remix)? Pule este passo. Se não, crie um em 1 minuto e adicione ./src/**/*.{ts,tsx} ao content do tailwind.config.

   ```bash
   npm create vite@latest minha-app -- --template react-ts
   cd minha-app
   npm install -D tailwindcss@3 postcss autoprefixer
   npx tailwindcss init -p
   ```

2. **Crie o arquivo src/components/EstouraBaloes.tsx** Copie o conteúdo de `src/EstouraBaloes.tsx` deste repositório. Ele é um arquivo só, sem dependência além de React.
3. **Use na sua página**

   ```tsx
   import EstouraBaloes from "./components/EstouraBaloes";
   
   <EstouraBaloes accent="#0057FF" cores={5} tirosParaDescer={6} />
   ```

4. **Personalize** Textos, dados e a cor de destaque (prop accent) são props com valor padrão. Troque pelos da sua marca ou ligue na sua API.

## Tema e cor

Abre em tema claro. Use `tema="escuro"` para o escuro e `accent` para a cor de destaque:

```tsx
<EstouraBaloes accent="#0057FF" cores={5} tirosParaDescer={6} />
```

## Licença

MIT. Pode usar em projeto pessoal ou comercial, de graça. A única condição é manter a linha **“Criado por FlowCore Soluções LTDA”** (ou o crédito de adaptação) onde ela está.

---

Precisa disso integrado no seu sistema? A [FlowCore](https://flowcoresolucoes.com.br) desenvolve sob medida.
