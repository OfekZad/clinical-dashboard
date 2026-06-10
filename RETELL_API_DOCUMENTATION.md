# Retell AI Integration - Assessment Submission Endpoint

## Endpoint

**URL:** `https://your-domain.vercel.app/api/assessment/submit`

**Method:** `POST`

**Content-Type:** `application/json`

## Request Body Structure

```json
{
  "patient": {
    "name": "Ofek Cohen",
    "pronouns": "he/him"
  },
  "assessment": {
    "tool": "OSDI",
    "assessment_date": "2025-01-25",
    "conducted_by": "Dr. Elad Medical Assistant",
    "reference_period_days": 7
  },
  "questions": [
    {
      "question_id": 1,
      "label": "Sensitivity to Light",
      "applicable": true,
      "patient_response": "Only strong sunlight bothers me occasionally.",
      "score": 1,
      "reasoning": "Symptoms occur infrequently and only under strong sunlight."
    },
    {
      "question_id": 7,
      "label": "Driving at Night",
      "applicable": false,
      "patient_response": "I don't drive.",
      "score": null,
      "reasoning": "Marked as not applicable per patient report."
    }
  ],
  "scoring": {
    "answered_questions": 11,
    "sum_of_scores": 18,
    "osdi_score": 40.9,
    "severity_classification": "Severe dry eye disease"
  },
  "key_observations": [
    "Symptoms worsen with screen use and dry environments",
    "Visual disturbance reported more than pain-related symptoms"
  ],
  "additional_notes": "Patient did not report constant pain but noted functional impact during daily activities."
}
```

## Field Descriptions

### `patient`
- **name** (string, required): Patient's full name (will be split into first/last name)
- **pronouns** (string, optional): Patient's preferred pronouns
- **date_of_birth** (string, optional): Patient's date of birth (YYYY-MM-DD format)

### `assessment`
- **tool** (string, required): Assessment tool used (e.g., "OSDI")
- **assessment_date** (string, required): Date in YYYY-MM-DD format
- **conducted_by** (string, required): Name of the person/AI conducting the assessment
- **reference_period_days** (number, required): Number of days the assessment covers

### `questions`
Array of question objects:
- **question_id** (number, required): Unique identifier for the question
- **label** (string, required): Question label/category
- **applicable** (boolean, required): Whether question applies to patient
- **patient_response** (string, required): Patient's verbatim response
- **score** (number | null, required): Numeric score (0-4) or null if not applicable
- **reasoning** (string, required): AI's reasoning for the score

### `scoring`
- **answered_questions** (number, required): Count of applicable questions
- **sum_of_scores** (number, required): Total of all scores
- **osdi_score** (number, required): Calculated OSDI score (0-100)
- **severity_classification** (string, required): One of:
  - "Normal"
  - "Mild dry eye disease"
  - "Moderate dry eye disease"
  - "Severe dry eye disease"

### `key_observations`
- Array of strings highlighting important clinical patterns

### `additional_notes`
- Optional string for any additional context

## Response

### Success (201 Created)
```json
{
  "success": true,
  "message": "Assessment submitted successfully",
  "data": {
    "patient_id": "uuid-here",
    "assessment_id": "uuid-here"
  }
}
```

### Error (500 Internal Server Error)
```json
{
  "success": false,
  "message": "Failed to submit assessment",
  "error": "Error details here"
}
```

## Automatic Processing

The endpoint automatically:
1. Creates new patient if not exists (matches by name)
2. Detects symptom flags:
   - Screen intolerance (score ≥3 on screen/reading questions)
   - Night driving issues (score ≥3 on night/driving questions)
   - Wind sensitivity (score ≥3 on wind-related questions)
   - Low humidity issues (score ≥3 on air/dry environment questions)
3. Stores all question responses with patient quotes
4. Creates clinician note from key observations and additional notes
5. Marks assessment as "unreviewed" for clinician follow-up

## Testing

Test locally:
```bash
curl -X POST http://localhost:3000/api/assessment/submit \
  -H "Content-Type: application/json" \
  -d @sample-payload.json
