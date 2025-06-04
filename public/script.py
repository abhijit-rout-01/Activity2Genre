from transformers import AutoModelForSequenceClassification, AutoTokenizer
import torch
import warnings
import json

warnings.filterwarnings('ignore')

# Load model and tokenizer
model_name = "KevSun/Personality_LM"
model = AutoModelForSequenceClassification.from_pretrained(model_name)
tokenizer = AutoTokenizer.from_pretrained(model_name)

# Move model to GPU if available
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)

# Choose between direct text input or file input
use_file = True  # Set to True if you want to read from a file

if use_file:
    file_path = 'F:\\Programs\\twitter-movie-analyzer\\text.txt'
    with open(file_path, 'r', encoding='utf-8') as file:
        new_text = file.read()
else:
    new_text = "India will be the world superpower"

# Encode text with tokenizer
encoded_input = tokenizer(new_text, return_tensors='pt', padding=True, truncation=True, max_length=512)
encoded_input = {key: val.to(device) for key, val in encoded_input.items()}

# Perform prediction
model.eval()
with torch.no_grad():
    outputs = model(**encoded_input)

# Compute softmax scores
predictions = torch.nn.functional.softmax(outputs.logits, dim=-1)[0].tolist()
data=json.dumps(predictions)
print(data) # Personality traits MODEL NEEDS TO BE TRAINED


# trait_names = ["agreeableness", "openness", "conscientiousness", "extraversion", "neuroticism"]
# for trait, score in zip(trait_names, predictions):
#     print(f"{score:.4f}")
