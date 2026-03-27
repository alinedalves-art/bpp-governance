#!/bin/bash
set -e

echo "Exportando Layer 1 — Ratio vs. Target..."
bq query --use_legacy_sql=false --format=json --max_rows=1000 '
WITH
targets AS (
    SELECT "202601" AS mes, 0.145610 AS target_pdd, 0.067885 AS target_pnr UNION ALL
    SELECT "202602",        0.154370,               0.065969             UNION ALL
    SELECT "202603",        0.165244,               0.077317             UNION ALL
    SELECT "202604",        0.134342,               0.060683             UNION ALL
    SELECT "202605",        0.146672,               0.061504             UNION ALL
    SELECT "202606",        0.134646,               0.060605             UNION ALL
    SELECT "202607",        0.134067,               0.069122             UNION ALL
    SELECT "202608",        0.132711,               0.075085             UNION ALL
    SELECT "202609",        0.133870,               0.070160             UNION ALL
    SELECT "202610",        0.134700,               0.055960             UNION ALL
    SELECT "202611",        0.137779,               0.047045             UNION ALL
    SELECT "202612",        0.134650,               0.037864
),
num AS (
    SELECT FORMAT_DATE("%Y%m", B.DATE_CREATED) AS mes, C.REASON_CLAIM, SUM(B.AMT_USD) AS cashout_usd
    FROM `meli-bi-data.WHOWNER.DM_CS_BPP_MONITORING_MED_NUM` B
    LEFT JOIN `meli-bi-data.WHOWNER.DM_CX_POST_PURCHASE` C ON C.CLA_CLAIM_ID = B.CLA_CLAIM_ID
    WHERE B.DATE_CREATED >= "2025-01-01" GROUP BY 1, 2
),
den AS (
    SELECT FORMAT_DATE("%Y%m", B.CI_CREATED_DATE) AS mes, C.REASON_CLAIM, SUM(B.GMV_USD) AS gmv_usd
    FROM `meli-bi-data.WHOWNER.DM_CS_BPP_MONITORING_MED_DENOM` B
    LEFT JOIN `meli-bi-data.WHOWNER.DM_CX_POST_PURCHASE` C ON C.CLA_CLAIM_ID = B.CLA_CLAIM_ID
    WHERE B.CI_CREATED_DATE >= "2025-01-01" GROUP BY 1, 2
),
ratio_realizado AS (
    SELECT COALESCE(n.mes, d.mes) AS mes, COALESCE(n.REASON_CLAIM, d.REASON_CLAIM) AS reason_claim,
        n.cashout_usd, d.gmv_usd, SAFE_DIVIDE(n.cashout_usd, d.gmv_usd) AS ratio_realizado
    FROM num n FULL JOIN den d ON n.mes = d.mes AND n.REASON_CLAIM = d.REASON_CLAIM
)
SELECT r.mes, r.reason_claim, ROUND(r.cashout_usd,2) AS cashout_usd, ROUND(r.gmv_usd,2) AS gmv_usd,
    ROUND(r.ratio_realizado,6) AS ratio_realizado,
    CASE WHEN r.reason_claim = "PDD" THEN t.target_pdd WHEN r.reason_claim = "PNR" THEN t.target_pnr END AS ratio_target,
    ROUND(r.ratio_realizado - CASE WHEN r.reason_claim = "PDD" THEN t.target_pdd WHEN r.reason_claim = "PNR" THEN t.target_pnr END, 6) AS variacao_vs_target
FROM ratio_realizado r LEFT JOIN targets t ON t.mes = r.mes
WHERE r.reason_claim IN ("PDD","PNR")
ORDER BY r.mes, r.reason_claim
' | grep '^\[' > /tmp/layer1.json

echo "window.LAYER1_DATA = $(cat /tmp/layer1.json);" > js/data/layer1.js
echo "Layer 1 exportado."

echo "Exportando Layer 2 — Visão Operacional..."
bq query --use_legacy_sql=false --format=json --max_rows=2000 '
SELECT
    t1.FECHA_CONTA_M AS mes,
    t1.TIPO,
    t1.L1_CAUSA_BPP,
    ANY_VALUE(t4.USER_OFFICE)       AS oficina,
    ANY_VALUE(t4.CS_CENTRO)         AS cs_centro,
    ANY_VALUE(t4.USER_TEAM_CHANNEL) AS canal,
    ANY_VALUE(t4.CS_SR_MANAGER)     AS sr_manager,
    ROUND(SUM(t1.VALORES), 2)       AS cashout_usd
FROM `meli-bi-data.WHOWNER.BT_CONTA_CAUSA_BPP_legacy` t1
LEFT JOIN (
    SELECT *
    FROM `meli-bi-data.WHOWNER.BT_CX_CONTACTS`
    WHERE CONTACT_DATETIME_ID >= DATETIME("2025-09-01")
    QUALIFY ROW_NUMBER() OVER (PARTITION BY ORD_ORDER_ID ORDER BY CLAIM_CLOSED_DATE DESC NULLS LAST) = 1
) T4 ON T4.ORD_ORDER_ID = T1.ORD_ORDER_ID
WHERE t1.FECHA_CONTA_M >= "202511"
  AND t1.fraude_adelantos = "NOT BOF"
  AND t1.flag_verdi = false
  AND t1.TIPO != "NMV"
  AND CASE
    WHEN t1.TIPO IN ("APLICACIONES","RECUPEROS") AND t1.SEGMENTO_SELLER_BPP = "FIRST PARTY" THEN FALSE
    WHEN t1.TIPO = "BONIFICADOR" AND t1.SEGMENTO_SELLER_BPP = "FIRST PARTY" AND t1.FLOW = "loan_for_change" THEN FALSE
    ELSE TRUE END
GROUP BY 1, 2, 3
ORDER BY mes, TIPO, cashout_usd DESC
' | grep '^\[' > /tmp/layer2.json

echo "window.LAYER2_DATA = $(cat /tmp/layer2.json);" > js/data/layer2.js
echo "Layer 2 exportado."
echo "Concluído."
