-- Update frequencies to add K or M prefix per MC4EB standard
-- K for 2000-29999 KHz (2.000-29.999 MHz)
-- M for everything else

UPDATE markers
SET frequency = CASE
    -- For frequencies in KHz range (2-29.999 MHz = 2000-29999 KHz)
    WHEN CAST(frequency AS FLOAT) >= 2.0 AND CAST(frequency AS FLOAT) < 30.0
    THEN 'K' || CAST((CAST(frequency AS FLOAT) * 1000) AS VARCHAR)
    -- For all other frequencies, use M prefix
    ELSE 'M' || frequency
END
WHERE frequency !~ '^[KM]';  -- Only update if not already prefixed

SELECT COUNT(*) as updated_count FROM markers WHERE frequency ~ '^[KM]';
