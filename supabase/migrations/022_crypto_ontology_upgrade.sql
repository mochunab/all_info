-- 온톨로지 개선: impacts 관계 타입 추가
ALTER TABLE crypto_relations DROP CONSTRAINT IF EXISTS crypto_relations_relation_type_check;
ALTER TABLE crypto_relations ADD CONSTRAINT crypto_relations_relation_type_check
  CHECK (relation_type IN ('mentions', 'recommends', 'correlates_with', 'part_of', 'impacts'));
