-- Migration: Objectives Periodicity & Sub-objectives
-- Feature: Objetivos personales con periodicidad (anual/semestral/trimestral) + pesos
-- 
-- Rules:
-- 1. Each employee has exactly 2 main objectives (objective_number = 1 or 2)
-- 2. Main objectives have periodicity: annual, semestral, trimestral
-- 3. Annual: no sub-objectives
-- 4. Semestral: exactly 2 sub-objectives
-- 5. Trimestral: exactly 4 sub-objectives
-- 6. Weight (peso) of main objectives must sum 100%
-- 7. Sub-objective weights are auto-calculated (divided equally)

-- =====================================================
-- STEP 1: Add new columns to objectives table
-- =====================================================

-- Periodicity for main objectives (how the objective is broken down)
ALTER TABLE objectives 
ADD COLUMN IF NOT EXISTS periodicity TEXT DEFAULT 'annual'
CHECK (periodicity IN ('annual', 'semestral', 'trimestral'));

COMMENT ON COLUMN objectives.periodicity IS 'How the objective is evaluated: annual (no sub-obj), semestral (2 sub-obj), trimestral (4 sub-obj)';

-- Weight percentage for main objectives (must sum 100% per employee/year)
ALTER TABLE objectives 
ADD COLUMN IF NOT EXISTS weight_pct INTEGER DEFAULT 50
CHECK (weight_pct >= 0 AND weight_pct <= 100);

COMMENT ON COLUMN objectives.weight_pct IS 'Weight percentage of the main objective (obj1 + obj2 must = 100)';

-- Parent objective ID for sub-objectives (self-referencing)
ALTER TABLE objectives 
ADD COLUMN IF NOT EXISTS parent_objective_id UUID REFERENCES objectives(id) ON DELETE CASCADE;

COMMENT ON COLUMN objectives.parent_objective_id IS 'Reference to parent objective (NULL for main objectives)';

-- Sub-objective number (1-4 depending on periodicity)
ALTER TABLE objectives 
ADD COLUMN IF NOT EXISTS sub_objective_number INTEGER
CHECK (sub_objective_number IS NULL OR (sub_objective_number >= 1 AND sub_objective_number <= 4));

COMMENT ON COLUMN objectives.sub_objective_number IS 'Number of the sub-objective (1-2 for semestral, 1-4 for trimestral)';

-- =====================================================
-- STEP 2: Create indexes for better query performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_objectives_parent_id ON objectives(parent_objective_id);
CREATE INDEX IF NOT EXISTS idx_objectives_periodicity ON objectives(periodicity);

-- =====================================================
-- STEP 3: Create view for objectives with sub-objectives
-- =====================================================

CREATE OR REPLACE VIEW objectives_with_details AS
SELECT 
    o.id,
    o.employee_id,
    o.created_by,
    o.year,
    o.period_type,
    o.title,
    o.description,
    o.progress_percentage,
    o.status,
    o.is_professional_development,
    o.objective_number,
    o.periodicity,
    o.weight_pct,
    o.parent_objective_id,
    o.sub_objective_number,
    o.achievement_percentage,
    o.achievement_notes,
    o.evaluated_at,
    o.evaluated_by,
    o.is_locked,
    o.created_at,
    o.updated_at,
    -- Employee info
    e.first_name || ' ' || e.last_name AS employee_name,
    e.job_title AS employee_job_title,
    -- Creator info
    c.first_name || ' ' || c.last_name AS creator_name,
    -- Count of sub-objectives
    (SELECT COUNT(*) FROM objectives sub WHERE sub.parent_objective_id = o.id) AS sub_objectives_count,
    -- Calculated progress for main objectives with sub-objectives
    CASE 
        WHEN o.parent_objective_id IS NULL AND o.periodicity != 'annual' THEN
            COALESCE(
                (SELECT AVG(sub.progress_percentage)::INTEGER 
                 FROM objectives sub 
                 WHERE sub.parent_objective_id = o.id),
                0
            )
        ELSE o.progress_percentage
    END AS calculated_progress
FROM objectives o
JOIN employees e ON o.employee_id = e.id
LEFT JOIN employees c ON o.created_by = c.id;

-- =====================================================
-- STEP 4: Function to calculate employee final score
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_employee_objectives_score(
    p_employee_id UUID,
    p_year INTEGER
) RETURNS TABLE (
    objective_1_title TEXT,
    objective_1_weight INTEGER,
    objective_1_progress INTEGER,
    objective_1_periodicity TEXT,
    objective_2_title TEXT,
    objective_2_weight INTEGER,
    objective_2_progress INTEGER,
    objective_2_periodicity TEXT,
    final_score NUMERIC
) AS $$
DECLARE
    obj1_weight INTEGER;
    obj1_progress INTEGER;
    obj2_weight INTEGER;
    obj2_progress INTEGER;
BEGIN
    -- Get objective 1
    SELECT 
        o.title,
        COALESCE(o.weight_pct, 50),
        CASE 
            WHEN o.periodicity = 'annual' THEN o.progress_percentage
            ELSE COALESCE(
                (SELECT AVG(sub.progress_percentage)::INTEGER FROM objectives sub WHERE sub.parent_objective_id = o.id),
                0
            )
        END,
        o.periodicity
    INTO objective_1_title, objective_1_weight, objective_1_progress, objective_1_periodicity
    FROM objectives o
    WHERE o.employee_id = p_employee_id 
      AND o.year = p_year 
      AND o.objective_number = 1 
      AND o.parent_objective_id IS NULL;

    -- Get objective 2
    SELECT 
        o.title,
        COALESCE(o.weight_pct, 50),
        CASE 
            WHEN o.periodicity = 'annual' THEN o.progress_percentage
            ELSE COALESCE(
                (SELECT AVG(sub.progress_percentage)::INTEGER FROM objectives sub WHERE sub.parent_objective_id = o.id),
                0
            )
        END,
        o.periodicity
    INTO objective_2_title, objective_2_weight, objective_2_progress, objective_2_periodicity
    FROM objectives o
    WHERE o.employee_id = p_employee_id 
      AND o.year = p_year 
      AND o.objective_number = 2 
      AND o.parent_objective_id IS NULL;

    -- Calculate final score
    obj1_weight := COALESCE(objective_1_weight, 0);
    obj1_progress := COALESCE(objective_1_progress, 0);
    obj2_weight := COALESCE(objective_2_weight, 0);
    obj2_progress := COALESCE(objective_2_progress, 0);

    IF obj1_weight + obj2_weight > 0 THEN
        final_score := (obj1_progress * obj1_weight + obj2_progress * obj2_weight)::NUMERIC / 100;
    ELSE
        final_score := 0;
    END IF;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_employee_objectives_score IS 'Calculates the final objectives score for an employee: (progress1 * weight1 + progress2 * weight2) / 100';

-- =====================================================
-- STEP 5: Validation function for objectives
-- =====================================================

CREATE OR REPLACE FUNCTION validate_objective_weights(
    p_employee_id UUID,
    p_year INTEGER
) RETURNS TABLE (
    is_valid BOOLEAN,
    total_weight INTEGER,
    objective_count INTEGER,
    error_message TEXT
) AS $$
DECLARE
    total INTEGER;
    obj_count INTEGER;
BEGIN
    SELECT 
        COALESCE(SUM(weight_pct), 0),
        COUNT(*)
    INTO total, obj_count
    FROM objectives
    WHERE employee_id = p_employee_id 
      AND year = p_year 
      AND parent_objective_id IS NULL
      AND objective_number IS NOT NULL;

    total_weight := total;
    objective_count := obj_count;

    IF obj_count != 2 THEN
        is_valid := FALSE;
        error_message := 'Se requieren exactamente 2 objetivos principales';
    ELSIF total != 100 THEN
        is_valid := FALSE;
        error_message := 'Los pesos deben sumar 100% (actual: ' || total || '%)';
    ELSE
        is_valid := TRUE;
        error_message := NULL;
    END IF;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_objective_weights IS 'Validates that an employee has exactly 2 objectives with weights summing to 100%';

-- =====================================================
-- STEP 6: Function to validate sub-objectives count
-- =====================================================

CREATE OR REPLACE FUNCTION validate_sub_objectives(
    p_objective_id UUID
) RETURNS TABLE (
    is_valid BOOLEAN,
    required_count INTEGER,
    actual_count INTEGER,
    error_message TEXT
) AS $$
DECLARE
    obj_periodicity TEXT;
    sub_count INTEGER;
    req_count INTEGER;
BEGIN
    -- Get the objective's periodicity
    SELECT periodicity INTO obj_periodicity
    FROM objectives
    WHERE id = p_objective_id AND parent_objective_id IS NULL;

    -- Count sub-objectives
    SELECT COUNT(*) INTO sub_count
    FROM objectives
    WHERE parent_objective_id = p_objective_id;

    -- Determine required count
    CASE obj_periodicity
        WHEN 'annual' THEN req_count := 0;
        WHEN 'semestral' THEN req_count := 2;
        WHEN 'trimestral' THEN req_count := 4;
        ELSE req_count := 0;
    END CASE;

    required_count := req_count;
    actual_count := sub_count;

    IF sub_count = req_count THEN
        is_valid := TRUE;
        error_message := NULL;
    ELSE
        is_valid := FALSE;
        IF obj_periodicity = 'semestral' THEN
            error_message := 'Objetivos semestrales requieren exactamente 2 sub-objetivos';
        ELSIF obj_periodicity = 'trimestral' THEN
            error_message := 'Objetivos trimestrales requieren exactamente 4 sub-objetivos';
        ELSE
            error_message := 'Los objetivos anuales no deben tener sub-objetivos';
        END IF;
    END IF;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_sub_objectives IS 'Validates that an objective has the correct number of sub-objectives based on its periodicity';

-- =====================================================
-- DONE
-- =====================================================
-- To apply: Run this migration in Supabase SQL editor
-- 
-- After applying:
-- 1. Update TypeScript types
-- 2. Update API endpoints
-- 3. Update UI components
