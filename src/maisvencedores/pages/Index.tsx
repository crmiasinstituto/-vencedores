import { Link } from "react-router-dom";

import "@/maisvencedores/landing/landing.css";
import { CanvasHero } from "@/maisvencedores/landing/CanvasHero";
import { Arco } from "@/maisvencedores/landing/Arco";
import { MuralDeMembros } from "@/maisvencedores/landing/MuralDeMembros";
import { FloatingCTA } from "@/maisvencedores/landing/FloatingCTA";
import { ProofSlot } from "@/maisvencedores/landing/ProofSlot";
import { AREAS, NUMEROS, PERKS, NAO_E_PARA_QUEM, TREINADORES } from "@/maisvencedores/landing/dados";

/**
 * Landing da Comunidade + que Vencedores (IAS Instituto).
 *
 * Três atos: NOITE (onde você está) → DOBRADIÇA (os 12 meses) → DIA (onde pode chegar).
 * O tema é fixo de propósito; ver landing.css.
 *
 * A landing anterior aqui era de NetWeaving (R$ 21.800/ano, "5 pilares", depoimentos
 * inventados com foto de banco de imagem) — recheio do template da Lovable que veio no clone
 * do portal. Não era o produto e não batia com o domínio iasinstituto.com.br.
 */
const Index = () => {
  return (
    <div className="mv-landing">
      <FloatingCTA />
      <div className="night">
        <header className="bar">
          <div className="wrap bar-in">
            <span className="mark">
              <i className="sig" />
              que Vencedores
            </span>
            <a className="btn" href="#entrar">
              <span className="lg">Quero fazer parte</span>
              <span className="sm">Fazer parte</span>
            </a>
          </div>
        </header>

        {/* HERO — o campo de sinais é a comunidade */}
        <section className="hero">
          {/* O rastro que segue o cursor, escolha do Carlos (ver CanvasHero). Substituiu o
              shader + o campo de "+". */}
          <CanvasHero />
          <div className="wrap">
            <p className="kicker">Uma iniciativa do IAS Instituto · desde 2019</p>
            {/* O gancho principal vira selo, em vez de ficar só em negrito no meio do texto. */}
            <span className="selo">
              <span className="dot" />
              Gratuito nos primeiros 12 meses
            </span>
            <h1>
              A maior comunidade de desenvolvimento{" "}
              <span className="hl">pessoal, profissional e financeiro</span> do Brasil.
            </h1>
            <p className="lede">
              Melhore sua vida espiritual, emocional, profissional e financeira ao lado de pessoas
              que decidiram viver com propósito. Aulas, treinamentos e cursos com{" "}
              <strong>Isaac Santos</strong> e os treinadores do IAS Instituto —{" "}
              <strong>gratuitos nos primeiros 12 meses</strong>.
            </p>
            <div className="hero-act">
              <a className="btn" href="#entrar">
                Quero fazer parte da comunidade <span className="a">→</span>
              </a>
              <p className="fine">
                Cadastro gratuito.
                <br />
                Sem cartão de crédito.
              </p>
            </div>

            <nav className="rail" aria-label="Áreas da comunidade">
              <span className="k">Sete áreas</span>
              {AREAS.map((a) => (
                <a href={`#${a.id}`} key={a.id}>
                  <i className="sig" />
                  {a.titulo}
                </a>
              ))}
            </nav>
          </div>
        </section>

        {/* MASSA */}
        <section className="mass">
          <div className="wrap">
            <div className="mass-top">
              <div>
                <p className="kicker">Vidas impactadas</p>
                <p className="huge" style={{ marginTop: 18 }}>
                  34<span className="u">.</span>000<span className="u">+</span>
                </p>
              </div>
              <div className="mass-figs">
                {NUMEROS.map((n) => (
                  <div className="mf" key={n.valor}>
                    <b>{n.valor}</b>
                    <span>{n.texto}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* A parede de rostos entra AQUI, logo abaixo do "34.000+": o número é a
                afirmação e os rostos são a prova. Some sozinha enquanto não houver membro
                com foto — ver MuralDeMembros. */}
            <div style={{ marginTop: 48 }}>
              <MuralDeMembros />
            </div>

            <div style={{ marginTop: 64 }}>
              <ProofSlot
                indice={1}
                o_que="Depoimentos, vídeos, fotos de eventos, resultados de alunos, prints, números."
                porque="O ponto mais caro da página: vem logo depois da promessa e antes de qualquer pedido. Se você tiver um só depoimento em vídeo, é aqui que ele vai."
              />
            </div>
          </div>
        </section>

        {/* AS SETE ÁREAS */}
        <section className="learn">
          <div className="wrap">
            <p className="kicker">O que você vai aprender</p>
            <h2 style={{ marginTop: 16, maxWidth: "17ch" }}>
              Sete áreas da vida, tratadas com a mesma seriedade.
            </h2>
            <p className="lede" style={{ marginTop: 20, maxWidth: "52ch" }}>
              Nenhuma delas existe sozinha. É por isso que estão todas aqui.
            </p>

            <div style={{ marginTop: 52 }}>
              {AREAS.map((a) => (
                <div className="area" id={a.id} key={a.id}>
                  <h3>{a.titulo}</h3>
                  <ul>
                    {a.itens.map((item) => (
                      <li key={item}>
                        <i className="sig" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* CTA no pico do desejo: a pessoa acabou de ver tudo que vai aprender. */}
            <div className="midcta">
              <p>
                Tudo isso, de graça, nos primeiros 12 meses.
                <span className="sub">Cadastro gratuito · sem cartão · menos de 1 minuto.</span>
              </p>
              <a className="btn" href="#entrar">
                Quero fazer parte <span className="a">→</span>
              </a>
            </div>
          </div>
        </section>

        {/* PERKS */}
        <section className="perks">
          <div className="wrap">
            <p className="kicker">Além das aulas</p>
            <h2 style={{ marginTop: 16, maxWidth: "15ch" }}>Você também terá acesso a…</h2>
            <div className="pg">
              {PERKS.map((p) => (
                <div className="pk" key={p.titulo}>
                  <i className="sig" />
                  <h3>{p.titulo}</h3>
                  <p>{p.texto}</p>
                  {p.nota && <p className="fn">{p.nota}</p>}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 56 }}>
              <ProofSlot
                indice={2}
                o_que="Mais depoimentos, prints de resultados, vídeos de alunos, fotos de eventos, histórias de transformação."
                porque="Aqui a prova sustenta a promessa das sete áreas. Prefira histórias que citem uma área específica."
              />
            </div>
          </div>
        </section>

        {/* MANIFESTO — a ausência do sinal */}
        <section className="manifesto">
          <div className="wrap">
            <p className="kicker">Sinceridade</p>
            <h2 style={{ marginTop: 16 }}>Esta comunidade não é para quem…</h2>
            <ul>
              {NAO_E_PARA_QUEM.map((item) => (
                <li key={item}>
                  <i className="sig minus" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      {/* ATO II: A DOBRADIÇA — a noite vira dia */}
      <Arco />

      {/* ATO III: DIA */}
      <div className="day">
        <section className="who">
          <div>
            <p className="kicker">Quem está por trás</p>
            <p className="mission">
              Transformar
              <br />
              vidas.
            </p>
            <p className="lede">
              Essa é a missão de <strong>Isaac Santos</strong> — professor universitário, escritor
              best-seller e fundador do IAS Instituto. Desde 2019, milhares de pessoas passaram
              pelos cursos, treinamentos, formações e mentorias do Instituto. A Comunidade + que
              Vencedores nasceu para levar essa transformação ainda mais longe.
            </p>
            <div className="team">
              <span className="k">Ao lado de</span>
              <ul>
                {TREINADORES.map((nome) => (
                  <li key={nome}>
                    <i className="sig" />
                    {nome}
                  </li>
                ))}
              </ul>
              <p className="etc">e outros treinadores do IAS Instituto</p>
            </div>
          </div>
          <ProofSlot
            indice={3}
            o_que="Fotos de Isaac em treinamentos, fotos da equipe e de eventos, bastidores, matérias na imprensa, certificados, livros publicados."
            porque="Esta seção fala de autoridade — e autoridade se mostra, não se afirma. Uma foto de auditório cheio faz mais aqui do que qualquer adjetivo."
          />
        </section>

        <section className="close" id="entrar">
          <div className="wrap close-grid">
            <div>
              <p className="kicker">Cadastro gratuito por tempo limitado</p>
              <h2 style={{ marginTop: 16 }}>Faça parte da Comunidade + que Vencedores.</h2>
              <p className="lede" style={{ marginTop: 20, maxWidth: "50ch" }}>
                Cadastre-se gratuitamente e tenha acesso aos conteúdos durante os primeiros{" "}
                <strong>12 meses</strong>. Depois, convide seus amigos e familiares para caminharem
                com você nessa jornada de crescimento.
              </p>
              <p className="kick2">Sua nova história pode começar hoje.</p>
            </div>
            <div>
              {/* Link do router, não <a href>: o cadastro é rota do próprio app
                  (/maisvencedores/cadastro) e recarregar a página aqui perderia o SPA. */}
              <Link className="btn" to="/maisvencedores/cadastro">
                Quero entrar agora <span className="a">→</span>
              </Link>
              <p className="fine" style={{ color: "#79839A" }}>
                Leva menos de 1 minuto.
              </p>
            </div>
          </div>
        </section>

        <footer>
          <div className="wrap foot">
            <span>IAS Instituto — Comunidade + que Vencedores</span>
            <span>Campanhas de indicação sujeitas a regulamento.</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Index;
