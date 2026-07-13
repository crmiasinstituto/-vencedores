#!/usr/bin/env python3
"""Gerador de PDF Premium para Diagnóstico Digital."""

import json
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib.colors import HexColor, white, Color
from reportlab.pdfgen import canvas
from reportlab.lib.utils import simpleSplit
import math

# === CORES PREMIUM ===
DARK_BG = HexColor('#0f172a')       # Slate 900 - fundo escuro
DARK_CARD = HexColor('#1e293b')     # Slate 800 - cards
ACCENT = HexColor('#3b82f6')        # Blue 500 - destaque principal
ACCENT_LIGHT = HexColor('#60a5fa')  # Blue 400
ACCENT_DARK = HexColor('#1d4ed8')   # Blue 700
GREEN = HexColor('#22c55e')         # Green 500
GREEN_BG = HexColor('#052e16')      # Green 950
ORANGE = HexColor('#f59e0b')        # Amber 500
ORANGE_BG = HexColor('#451a03')     # Amber 950
RED = HexColor('#ef4444')           # Red 500
RED_BG = HexColor('#450a0a')        # Red 950
WHITE = white
TEXT_PRIMARY = HexColor('#f8fafc')   # Slate 50
TEXT_SECONDARY = HexColor('#94a3b8') # Slate 400
TEXT_MUTED = HexColor('#64748b')     # Slate 500
BORDER = HexColor('#334155')         # Slate 700
LIGHT_BG = HexColor('#f8fafc')      # Para páginas claras
LIGHT_TEXT = HexColor('#1e293b')
LIGHT_SECONDARY = HexColor('#64748b')
LIGHT_BORDER = HexColor('#e2e8f0')
LIGHT_CARD = HexColor('#ffffff')

W, H = A4


def draw_dark_bg(c):
    """Fundo escuro premium."""
    c.setFillColor(DARK_BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)


def draw_light_bg(c):
    """Fundo claro para páginas de conteúdo."""
    c.setFillColor(LIGHT_BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    # Barra lateral azul sutil
    c.setFillColor(ACCENT)
    c.rect(0, 0, 4*mm, H, fill=1, stroke=0)


def draw_page_number(c, page_num, total, dark=False):
    """Número da página no rodapé."""
    c.setFont("Helvetica", 8)
    color = TEXT_MUTED if dark else LIGHT_SECONDARY
    c.setFillColor(color)
    c.drawCentredString(W/2, 1.5*cm, f"{page_num} / {total}")


def draw_header_bar(c, title, page_num, total):
    """Barra de header nas páginas de conteúdo."""
    # Header bar
    c.setFillColor(DARK_BG)
    c.rect(0, H - 1.8*cm, W, 1.8*cm, fill=1, stroke=0)
    # Linha accent embaixo
    c.setFillColor(ACCENT)
    c.rect(0, H - 1.85*cm, W, 0.8*mm, fill=1, stroke=0)
    # Título
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(WHITE)
    c.drawString(2*cm, H - 1.3*cm, title.upper())
    # Página
    c.setFont("Helvetica", 8)
    c.setFillColor(TEXT_SECONDARY)
    c.drawRightString(W - 2*cm, H - 1.3*cm, f"{page_num}/{total}")


def wrap_text(text, font, size, max_width):
    """Quebra texto em linhas."""
    return simpleSplit(text, font, size, max_width)


def draw_wrapped_text(c, text, x, y, font, size, color, max_width, leading=None):
    """Desenha texto com quebra de linha. Retorna y final."""
    if leading is None:
        leading = size * 1.5
    c.setFont(font, size)
    c.setFillColor(color)
    lines = wrap_text(text, font, size, max_width)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def get_score_color(nota):
    if nota >= 7:
        return GREEN
    elif nota >= 5:
        return ORANGE
    else:
        return RED


def get_score_bg(nota):
    if nota >= 7:
        return GREEN_BG
    elif nota >= 5:
        return ORANGE_BG
    else:
        return RED_BG


# ============================================================
# PÁGINA 1 - CAPA PREMIUM (DARK)
# ============================================================
def page_cover(c, data):
    draw_dark_bg(c)

    # Elementos decorativos - círculos sutis
    c.setFillColor(HexColor('#1e293b'))
    c.circle(W + 3*cm, H - 5*cm, 8*cm, fill=1, stroke=0)
    c.circle(-4*cm, 3*cm, 6*cm, fill=1, stroke=0)

    # Linha accent no topo
    c.setFillColor(ACCENT)
    c.rect(0, H - 4*mm, W, 4*mm, fill=1, stroke=0)

    # Tipo do documento
    y = H - 4*cm
    c.setFont("Helvetica", 11)
    c.setFillColor(ACCENT_LIGHT)
    c.drawString(3*cm, y, "RELATÓRIO DE ANÁLISE")

    # Título principal
    y -= 1.5*cm
    c.setFont("Helvetica-Bold", 36)
    c.setFillColor(WHITE)
    c.drawString(3*cm, y, "DIAGNÓSTICO")
    y -= 1.2*cm
    c.drawString(3*cm, y, "DIGITAL")

    # Linha decorativa
    y -= 1*cm
    c.setFillColor(ACCENT)
    c.rect(3*cm, y, 6*cm, 3*mm, fill=1, stroke=0)

    # Nome da empresa
    y -= 1.5*cm
    c.setFont("Helvetica-Bold", 16)
    c.setFillColor(TEXT_PRIMARY)
    c.drawString(3*cm, y, data['empresa'])

    y -= 0.7*cm
    c.setFont("Helvetica", 11)
    c.setFillColor(TEXT_SECONDARY)
    c.drawString(3*cm, y, data.get('cidade', ''))

    # Card de informações na parte inferior
    card_y = 7*cm
    card_h = 5.5*cm
    card_x = 3*cm
    card_w = W - 6*cm

    # Fundo do card
    c.setFillColor(DARK_CARD)
    c.roundRect(card_x, card_y - card_h, card_w, card_h, 6, fill=1, stroke=0)

    # Borda superior do card
    c.setFillColor(ACCENT)
    c.rect(card_x, card_y, card_w, 2, fill=1, stroke=0)

    # Dados no card
    info_items = [
        ("Instagram", data.get('instagram', '')),
        ("Site", data.get('site', '')),
        ("Telefone", data.get('telefone', '')),
        ("Data", data.get('data', '')),
    ]

    item_y = card_y - 0.8*cm
    for label, value in info_items:
        c.setFont("Helvetica", 8)
        c.setFillColor(TEXT_MUTED)
        c.drawString(card_x + 0.8*cm, item_y, label.upper())
        c.setFont("Helvetica-Bold", 10.5)
        c.setFillColor(TEXT_PRIMARY)
        c.drawString(card_x + 0.8*cm, item_y - 0.5*cm, value)
        item_y -= 1.2*cm

    # Elaborado por - rodapé
    c.setFont("Helvetica", 9)
    c.setFillColor(TEXT_MUTED)
    c.drawString(3*cm, 1.2*cm, f"Elaborado por {data.get('elaborado_por', '')}")

    c.showPage()


# ============================================================
# PÁGINA 2 - SUMÁRIO EXECUTIVO (DARK)
# ============================================================
def page_sumario(c, data):
    draw_dark_bg(c)

    # Header
    y = H - 2.5*cm
    c.setFont("Helvetica", 9)
    c.setFillColor(ACCENT_LIGHT)
    c.drawString(2.5*cm, y, "01")
    y -= 0.8*cm
    c.setFont("Helvetica-Bold", 24)
    c.setFillColor(WHITE)
    c.drawString(2.5*cm, y, "Sumário Executivo")

    # Linha
    y -= 0.6*cm
    c.setFillColor(ACCENT)
    c.rect(2.5*cm, y, 4*cm, 2, fill=1, stroke=0)

    # Texto do sumário
    y -= 1*cm
    max_w = W - 5*cm
    y = draw_wrapped_text(c, data.get('sumario', ''), 2.5*cm, y,
                          "Helvetica", 10, TEXT_SECONDARY, max_w, leading=16)

    # Score cards
    y -= 1.2*cm
    notas = data.get('notas', {})
    label_map = {
        'google_meu_negocio': 'Google Meu Negócio',
        'site_seo': 'Site (SEO)',
        'site_conversao': 'Site (Conversão)',
        'instagram_posicionamento': 'Instagram (Posicionamento)',
        'instagram_engajamento': 'Instagram (Engajamento)',
    }

    card_w = (W - 5.5*cm) / 2 - 0.3*cm
    col = 0
    row_y = y

    all_notas = []
    for key, label in label_map.items():
        if key in notas:
            n = notas[key]
            nota_val = n['nota']
            all_notas.append(nota_val)
            score_color = get_score_color(nota_val)
            score_bg = get_score_bg(nota_val)

            cx = 2.5*cm + col * (card_w + 0.6*cm)
            cy = row_y

            # Card background
            c.setFillColor(DARK_CARD)
            c.roundRect(cx, cy - 1.8*cm, card_w, 1.8*cm, 4, fill=1, stroke=0)

            # Barra de progresso
            bar_w = card_w - 1.2*cm
            bar_x = cx + 0.6*cm
            bar_y = cy - 1.5*cm

            # Background da barra
            c.setFillColor(BORDER)
            c.roundRect(bar_x, bar_y, bar_w, 5*mm, 2, fill=1, stroke=0)

            # Progresso
            progress_w = bar_w * (nota_val / 10)
            c.setFillColor(score_color)
            c.roundRect(bar_x, bar_y, progress_w, 5*mm, 2, fill=1, stroke=0)

            # Label
            c.setFont("Helvetica", 8.5)
            c.setFillColor(TEXT_SECONDARY)
            c.drawString(cx + 0.6*cm, cy - 0.6*cm, label)

            # Nota
            c.setFont("Helvetica-Bold", 14)
            c.setFillColor(score_color)
            c.drawRightString(cx + card_w - 0.6*cm, cy - 0.7*cm, f"{nota_val}")

            col += 1
            if col >= 2:
                col = 0
                row_y -= 2.2*cm

    # Nota geral
    if all_notas:
        media = round(sum(all_notas) / len(all_notas), 1)
        gen_color = get_score_color(media)

        gen_y = row_y - 0.3*cm
        gen_w = W - 5*cm

        c.setFillColor(DARK_CARD)
        c.roundRect(2.5*cm, gen_y - 2*cm, gen_w, 2*cm, 4, fill=1, stroke=0)

        # Borda esquerda colorida
        c.setFillColor(gen_color)
        c.rect(2.5*cm, gen_y - 2*cm, 4*mm, 2*cm, fill=1, stroke=0)

        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(TEXT_PRIMARY)
        c.drawString(3.3*cm, gen_y - 0.8*cm, "NOTA GERAL DA PRESENÇA DIGITAL")

        c.setFont("Helvetica-Bold", 22)
        c.setFillColor(gen_color)
        c.drawRightString(W - 3*cm, gen_y - 1*cm, f"{media}/10")

        # Barra de progresso geral
        bar_w = gen_w - 2*cm
        bar_x = 3.3*cm
        bar_y = gen_y - 1.7*cm
        c.setFillColor(BORDER)
        c.roundRect(bar_x, bar_y, bar_w, 4*mm, 2, fill=1, stroke=0)
        c.setFillColor(gen_color)
        c.roundRect(bar_x, bar_y, bar_w * (media/10), 4*mm, 2, fill=1, stroke=0)

    draw_page_number(c, 2, 7, dark=True)
    c.showPage()


# ============================================================
# PÁGINA 3 - ANÁLISE DO SITE (LIGHT)
# ============================================================
def page_site(c, data):
    draw_light_bg(c)
    draw_header_bar(c, "Análise do Site", 3, 7)

    y = H - 3*cm

    # Seção SEO
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(DARK_BG)
    c.drawString(2*cm, y, "SEO")

    nota_seo = data.get('notas', {}).get('site_seo', {}).get('nota', 0)
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(get_score_color(nota_seo))
    c.drawRightString(W - 2*cm, y, f"{nota_seo}/10")

    y -= 0.5*cm
    c.setFillColor(LIGHT_BORDER)
    c.rect(2*cm, y, W - 4*cm, 0.5, fill=1, stroke=0)

    y -= 0.6*cm
    max_w = W - 4.5*cm

    for item in data.get('seo_problemas', []):
        is_positive = any(w in item.lower() for w in ['positivo', 'bom', 'ponto positivo'])
        dot_color = GREEN if is_positive else RED

        c.setFillColor(dot_color)
        c.circle(2.3*cm, y + 0.1*cm, 2.5, fill=1, stroke=0)

        y = draw_wrapped_text(c, item, 2.7*cm, y, "Helvetica", 9, LIGHT_TEXT, max_w, leading=13)
        y -= 0.25*cm

        if y < 3*cm:
            break

    # Seção Conversão
    y -= 0.5*cm
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(DARK_BG)
    c.drawString(2*cm, y, "Conversão")

    nota_conv = data.get('notas', {}).get('site_conversao', {}).get('nota', 0)
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(get_score_color(nota_conv))
    c.drawRightString(W - 2*cm, y, f"{nota_conv}/10")

    y -= 0.5*cm
    c.setFillColor(LIGHT_BORDER)
    c.rect(2*cm, y, W - 4*cm, 0.5, fill=1, stroke=0)

    y -= 0.6*cm

    for item in data.get('conversao_problemas', []):
        is_positive = any(w in item.lower() for w in ['positivo', 'bom'])
        dot_color = GREEN if is_positive else ORANGE

        c.setFillColor(dot_color)
        c.circle(2.3*cm, y + 0.1*cm, 2.5, fill=1, stroke=0)

        y = draw_wrapped_text(c, item, 2.7*cm, y, "Helvetica", 9, LIGHT_TEXT, max_w, leading=13)
        y -= 0.25*cm

        if y < 2*cm:
            break

    draw_page_number(c, 3, 7)
    c.showPage()


# ============================================================
# PÁGINA 4 - GOOGLE MEU NEGÓCIO (LIGHT)
# ============================================================
def page_gmb(c, data):
    draw_light_bg(c)
    draw_header_bar(c, "Google Meu Negócio", 4, 7)

    y = H - 3*cm

    nota_gmb = data.get('notas', {}).get('google_meu_negocio', {}).get('nota', 0)

    # Score badge grande
    badge_x = W/2
    c.setFillColor(get_score_color(nota_gmb))
    c.circle(badge_x, y - 0.5*cm, 1.2*cm, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 18)
    c.setFillColor(WHITE)
    c.drawCentredString(badge_x, y - 0.8*cm, f"{nota_gmb}")

    y -= 2.5*cm
    max_w = W - 5*cm

    for item in data.get('gmb_analise', []):
        is_strong = item.startswith('PONTO FORTE')
        is_opp = item.startswith('OPORTUNIDADE')

        # Card
        lines = wrap_text(item, "Helvetica", 9, max_w - 1.5*cm)
        card_h = max(len(lines) * 13 + 16, 1.2*cm)

        if y - card_h < 2*cm:
            break

        card_color = HexColor('#f0fdf4') if is_strong else HexColor('#eff6ff')
        border_color = GREEN if is_strong else ACCENT

        c.setFillColor(card_color)
        c.roundRect(2.2*cm, y - card_h, W - 4.4*cm, card_h, 3, fill=1, stroke=0)

        # Borda esquerda
        c.setFillColor(border_color)
        c.rect(2.2*cm, y - card_h, 3*mm, card_h, fill=1, stroke=0)

        # Texto
        text_y = y - 0.5*cm
        for line in lines:
            c.setFont("Helvetica", 9)
            c.setFillColor(LIGHT_TEXT)
            c.drawString(2.9*cm, text_y, line)
            text_y -= 13

        y -= card_h + 0.3*cm

    draw_page_number(c, 4, 7)
    c.showPage()


# ============================================================
# PÁGINA 5 - INSTAGRAM (LIGHT)
# ============================================================
def page_instagram(c, data):
    draw_light_bg(c)
    draw_header_bar(c, "Análise do Instagram", 5, 7)

    y = H - 3*cm
    metricas = data.get('instagram_metricas', {})
    analises = data.get('instagram_metricas_analise', {})

    # Métricas em cards horizontais
    metric_items = [
        ('seguidores', 'Seguidores'),
        ('seguindo', 'Seguindo'),
        ('highlights', 'Highlights'),
    ]

    card_w = (W - 4.5*cm) / 3 - 0.2*cm
    for i, (key, label) in enumerate(metric_items):
        cx = 2*cm + i * (card_w + 0.3*cm)

        c.setFillColor(DARK_BG)
        c.roundRect(cx, y - 1.6*cm, card_w, 1.6*cm, 4, fill=1, stroke=0)

        c.setFont("Helvetica", 7.5)
        c.setFillColor(TEXT_SECONDARY)
        c.drawString(cx + 0.4*cm, y - 0.5*cm, label.upper())

        val = metricas.get(key, 'N/A')
        # Truncar valor se muito longo
        display_val = val if len(str(val)) < 15 else str(val)[:14]
        c.setFont("Helvetica-Bold", 13)
        c.setFillColor(WHITE)
        c.drawString(cx + 0.4*cm, y - 1.1*cm, display_val)

    y -= 2.5*cm

    # Análise por métrica
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(DARK_BG)
    c.drawString(2*cm, y, "Análise das Métricas")
    y -= 0.3*cm
    c.setFillColor(LIGHT_BORDER)
    c.rect(2*cm, y, W - 4*cm, 0.5, fill=1, stroke=0)
    y -= 0.5*cm

    max_w = W - 5*cm
    for key in ['seguidores', 'seguindo', 'highlights', 'bio_link']:
        analise = analises.get(key, '')
        if not analise:
            continue
        label = key.replace('_', ' ').title()

        c.setFillColor(RED)
        c.circle(2.3*cm, y + 0.1*cm, 2.5, fill=1, stroke=0)

        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(LIGHT_TEXT)
        c.drawString(2.7*cm, y, f"{label}:")

        y -= 0.45*cm
        y = draw_wrapped_text(c, analise, 2.7*cm, y, "Helvetica", 9, LIGHT_SECONDARY, max_w, leading=13)
        y -= 0.4*cm

    # Posicionamento
    y -= 0.3*cm
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(DARK_BG)
    c.drawString(2*cm, y, "Problemas de Posicionamento")
    y -= 0.3*cm
    c.setFillColor(LIGHT_BORDER)
    c.rect(2*cm, y, W - 4*cm, 0.5, fill=1, stroke=0)
    y -= 0.5*cm

    for item in data.get('instagram_posicionamento_problemas', [])[:4]:
        c.setFillColor(ORANGE)
        c.circle(2.3*cm, y + 0.1*cm, 2.5, fill=1, stroke=0)
        y = draw_wrapped_text(c, item, 2.7*cm, y, "Helvetica", 9, LIGHT_TEXT, max_w, leading=13)
        y -= 0.3*cm
        if y < 2*cm:
            break

    draw_page_number(c, 5, 7)
    c.showPage()


# ============================================================
# PÁGINA 6 - OPORTUNIDADES (DARK)
# ============================================================
def page_oportunidades(c, data):
    draw_dark_bg(c)

    y = H - 2.5*cm
    c.setFont("Helvetica", 9)
    c.setFillColor(ACCENT_LIGHT)
    c.drawString(2.5*cm, y, "05")
    y -= 0.8*cm
    c.setFont("Helvetica-Bold", 24)
    c.setFillColor(WHITE)
    c.drawString(2.5*cm, y, "Plano de Ação")

    y -= 0.6*cm
    c.setFillColor(ACCENT)
    c.rect(2.5*cm, y, 4*cm, 2, fill=1, stroke=0)

    max_w = W - 6*cm

    sections = [
        ("Quick Wins", "30 dias", 'quick_wins', GREEN),
        ("Médio Prazo", "60-90 dias", 'medio_prazo', ORANGE),
        ("Longo Prazo", "6-12 meses", 'longo_prazo', ACCENT),
    ]

    for title, timeframe, key, color in sections:
        items = data.get(key, [])
        if not items:
            continue

        y -= 1*cm

        # Título da seção
        c.setFont("Helvetica-Bold", 12)
        c.setFillColor(color)
        c.drawString(2.5*cm, y, title)

        c.setFont("Helvetica", 9)
        c.setFillColor(TEXT_MUTED)
        c.drawRightString(W - 2.5*cm, y, timeframe)

        y -= 0.3*cm
        c.setFillColor(BORDER)
        c.rect(2.5*cm, y, W - 5*cm, 0.5, fill=1, stroke=0)
        y -= 0.5*cm

        for i, item in enumerate(items[:4], 1):
            # Número
            c.setFont("Helvetica-Bold", 9)
            c.setFillColor(color)
            c.drawString(2.5*cm, y, f"{i:02d}")

            # Texto
            y = draw_wrapped_text(c, item, 3.3*cm, y, "Helvetica", 9, TEXT_SECONDARY, max_w, leading=13)
            y -= 0.35*cm

            if y < 2.5*cm:
                break

        if y < 2.5*cm:
            break

    draw_page_number(c, 6, 7, dark=True)
    c.showPage()


# ============================================================
# PÁGINA 7 - IMPACTO + CTA (DARK)
# ============================================================
def page_impacto(c, data):
    draw_dark_bg(c)

    y = H - 2.5*cm
    c.setFont("Helvetica", 9)
    c.setFillColor(ACCENT_LIGHT)
    c.drawString(2.5*cm, y, "06")
    y -= 0.8*cm
    c.setFont("Helvetica-Bold", 24)
    c.setFillColor(WHITE)
    c.drawString(2.5*cm, y, "Estimativa de Impacto")

    y -= 0.6*cm
    c.setFillColor(ACCENT)
    c.rect(2.5*cm, y, 4*cm, 2, fill=1, stroke=0)

    y -= 1.2*cm

    impacto = data.get('impacto', [])

    # Tabela
    col_widths = [5*cm, 3*cm, 3.5*cm, 3*cm]
    headers = ['Métrica', 'Atual', 'Projetado', 'Crescimento']
    table_x = 2.2*cm

    # Header da tabela
    c.setFillColor(DARK_CARD)
    c.roundRect(table_x, y - 0.8*cm, sum(col_widths) + 0.5*cm, 0.8*cm, 3, fill=1, stroke=0)

    cx = table_x + 0.3*cm
    for i, h in enumerate(headers):
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(TEXT_MUTED)
        c.drawString(cx, y - 0.55*cm, h.upper())
        cx += col_widths[i]

    y -= 1.1*cm

    # Linhas
    for item in impacto:
        cx = table_x + 0.3*cm

        c.setFont("Helvetica", 9)
        c.setFillColor(TEXT_PRIMARY)
        c.drawString(cx, y, item['metrica'])
        cx += col_widths[0]

        c.setFillColor(TEXT_SECONDARY)
        c.drawString(cx, y, item['atual'])
        cx += col_widths[1]

        c.setFillColor(ACCENT_LIGHT)
        c.drawString(cx, y, item['projetado'])
        cx += col_widths[2]

        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(GREEN)
        c.drawString(cx, y, item['crescimento'])

        y -= 0.5*cm

        # Linha separadora sutil
        c.setFillColor(BORDER)
        c.rect(table_x, y + 0.1*cm, sum(col_widths) + 0.5*cm, 0.3, fill=1, stroke=0)
        y -= 0.3*cm

    # CTA
    y -= 1.5*cm

    # Card CTA
    cta_h = 4.5*cm
    cta_w = W - 5*cm

    c.setFillColor(DARK_CARD)
    c.roundRect(2.5*cm, y - cta_h, cta_w, cta_h, 6, fill=1, stroke=0)

    # Borda superior accent
    c.setFillColor(ACCENT)
    c.rect(2.5*cm, y, cta_w, 2, fill=1, stroke=0)

    # Texto CTA
    cta_y = y - 1*cm
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(WHITE)
    c.drawString(3.2*cm, cta_y, "Próximo Passo")

    cta_y -= 0.8*cm
    cta_text = (
        f"Convido vocês para uma conversa de 30 minutos onde vou apresentar "
        f"esse diagnóstico em detalhes e discutir um plano personalizado "
        f"para a {data['empresa']}. Sem compromisso."
    )
    cta_y = draw_wrapped_text(c, cta_text, 3.2*cm, cta_y,
                               "Helvetica", 10, TEXT_SECONDARY, cta_w - 1.5*cm, leading=15)

    cta_y -= 0.5*cm
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(ACCENT_LIGHT)
    c.drawString(3.2*cm, cta_y, data.get('elaborado_por', ''))
    cta_y -= 0.5*cm
    c.setFont("Helvetica", 9)
    c.setFillColor(TEXT_MUTED)
    c.drawString(3.2*cm, cta_y, data.get('email', ''))

    draw_page_number(c, 7, 7, dark=True)
    c.showPage()


# ============================================================
# MAIN
# ============================================================
def generate(data, output_path):
    c_pdf = canvas.Canvas(output_path, pagesize=A4)
    c_pdf.setTitle(f"Diagnóstico Digital - {data['empresa']}")
    c_pdf.setAuthor(data.get('elaborado_por', ''))

    page_cover(c_pdf, data)
    page_sumario(c_pdf, data)
    page_site(c_pdf, data)
    page_gmb(c_pdf, data)
    page_instagram(c_pdf, data)
    page_oportunidades(c_pdf, data)
    page_impacto(c_pdf, data)

    c_pdf.save()
    print(f"PDF premium gerado: {output_path}")


if __name__ == '__main__':
    import argparse
    import sys

    parser = argparse.ArgumentParser(
        description='Gerador de PDF Premium de Diagnóstico Digital (dark theme)'
    )
    parser.add_argument('--data', help='JSON string com os dados do diagnóstico')
    parser.add_argument('--data-file', help='Caminho para arquivo JSON com os dados')
    parser.add_argument('--output', required=True, help='Caminho do PDF de saída')
    args = parser.parse_args()

    if args.data_file:
        with open(args.data_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    elif args.data:
        data = json.loads(args.data)
    else:
        print('Erro: use --data ou --data-file', file=sys.stderr)
        sys.exit(1)

    generate(data, args.output)
