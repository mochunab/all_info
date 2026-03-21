-- 유령 거래 정리: position_id=null 거래 + 중복 매도 제거
-- 1. FLOKI 유령 매도 (monkey, position_id=null)
DELETE FROM battle_trades WHERE id = '4ee38515-5fe1-4b13-9094-f506f5339cfe';

-- 2. GIGA 유령 매수 (robot, position_id=null)
DELETE FROM battle_trades WHERE id = 'ce45e988-6f73-406d-8165-3e96e8250d75';

-- 3. NEAR 중복 매도 (같은 포지션에 2번 매도, 두 번째 것 삭제)
DELETE FROM battle_trades WHERE id = '73839a1f-571d-4d90-bc34-ed93c7b475ad';

-- 4. APT 중복 매도 (같은 포지션에 2번 매도, 두 번째 것 삭제)
DELETE FROM battle_trades WHERE id = 'c9179632-3fa0-47a8-b900-4e352f3a3ba9';
