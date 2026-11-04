/*
 * Captura de Páginas — + que Vencedores CRM
 *
 * Cole na landing page (gerado em Marketing > Captura de Páginas):
 *   <script src="https://iasinstituto.com.br/captura.js" data-integracao="slug" data-chave="chave" defer></script>
 *
 * Opcional: data-form="#id-do-formulario" pra escolher o formulário. Sem ele, o script assume todo
 * formulário da página que tenha campo de e-mail ou telefone. Envia nome, e-mail, WhatsApp, os demais
 * campos com name e as UTMs da URL. Depois mostra a mensagem de sucesso ou redireciona.
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var slug = script.getAttribute('data-integracao');
  var chave = script.getAttribute('data-chave');
  var seletor = script.getAttribute('data-form');
  if (!slug || !chave) {
    console.warn('[captura] faltam data-integracao e data-chave no <script>');
    return;
  }
  var endpoint = new URL('/.netlify/functions/captura-pagina', script.src).href +
    '?f=' + encodeURIComponent(slug) + '&chave=' + encodeURIComponent(chave);

  var PADROES = {
    name: /(^|[^a-z])(nome|name|fullname|full_name)([^a-z]|$)/i,
    email: /e-?mail/i,
    phone: /(telefone|phone|whats|celular|cel|fone|tel)/i,
  };

  function rotulo(campo) {
    return [campo.name, campo.id, campo.getAttribute('placeholder'), campo.getAttribute('aria-label')]
      .filter(Boolean).join(' ');
  }

  function acharCampo(form, tipo) {
    var campos = form.querySelectorAll('input, select, textarea');
    for (var i = 0; i < campos.length; i++) {
      var c = campos[i];
      if (c.type === 'hidden' || c.type === 'submit' || c.type === 'checkbox' || c.type === 'radio') continue;
      if (tipo === 'email' && c.type === 'email') return c;
      if (tipo === 'phone' && c.type === 'tel') return c;
    }
    for (var j = 0; j < campos.length; j++) {
      var d = campos[j];
      if (d.type === 'hidden' || d.type === 'submit') continue;
      if (PADROES[tipo].test(rotulo(d))) return d;
    }
    return null;
  }

  function ehFormularioDeCaptura(form) {
    if (seletor) return form.matches(seletor);
    return !!(acharCampo(form, 'email') || acharCampo(form, 'phone'));
  }

  function aviso(form, texto, erro) {
    var caixa = form.querySelector('[data-captura-msg]');
    if (!caixa) {
      caixa = document.createElement('div');
      caixa.setAttribute('data-captura-msg', '');
      caixa.style.cssText = 'margin-top:12px;padding:10px 12px;border-radius:8px;font:14px/1.4 system-ui,sans-serif;';
      form.appendChild(caixa);
    }
    caixa.style.background = erro ? '#fdecec' : '#e9f7ef';
    caixa.style.color = erro ? '#9b1c1c' : '#14532d';
    caixa.textContent = texto;
  }

  function dados(form) {
    var out = {};
    var nome = acharCampo(form, 'name'), email = acharCampo(form, 'email'), fone = acharCampo(form, 'phone');
    var campos = form.querySelectorAll('input, select, textarea');
    for (var i = 0; i < campos.length; i++) {
      var c = campos[i];
      if (c === nome || c === email || c === fone) continue;
      if (!c.name || c.type === 'submit' || c.type === 'password') continue;
      if ((c.type === 'checkbox' || c.type === 'radio') && !c.checked) continue;
      if (c.value) out[c.name] = c.value;
    }
    if (nome && nome.value) out.nome = nome.value.trim();
    if (email && email.value) out.email = email.value.trim();
    if (fone && fone.value) out.telefone = fone.value.trim();
    var p = new URLSearchParams(window.location.search);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'].forEach(function (k) {
      if (p.get(k)) out[k] = p.get(k);
    });
    out.pagina_url = window.location.href.split('#')[0];
    return out;
  }

  // Escuta na fase de captura pra rodar antes de qualquer script da própria página
  window.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || form.tagName !== 'FORM' || !ehFormularioDeCaptura(form)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (form.getAttribute('data-captura-enviando')) return;

    var corpo = dados(form);
    if (!corpo.nome || !corpo.telefone || String(corpo.telefone).replace(/\D/g, '').length < 10) {
      aviso(form, 'Preencha seu nome e o WhatsApp com DDD.', true);
      return;
    }

    var botao = form.querySelector('button[type=submit], input[type=submit], button:not([type])');
    var textoBotao = botao ? (botao.value || botao.textContent) : '';
    form.setAttribute('data-captura-enviando', '1');
    if (botao) { botao.disabled = true; }
    aviso(form, 'Enviando...', false);

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.ok) throw new Error(j.error); return j; }); })
      .then(function (j) {
        aviso(form, j.success_message || 'Inscrição confirmada!', false);
        form.reset();
        if (j.redirect_url) window.location.href = j.redirect_url;
      })
      .catch(function () {
        aviso(form, 'Não conseguimos enviar agora. Tente de novo em alguns segundos.', true);
      })
      .then(function () {
        form.removeAttribute('data-captura-enviando');
        if (botao) { botao.disabled = false; if (botao.value) botao.value = textoBotao; }
      });
  }, true);
})();
