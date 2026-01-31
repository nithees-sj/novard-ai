# Structured Output Guide for Novard AI

This guide shows how to format AI model responses to display with professional, structured formatting in the Doubts & Learning interface.

## Overview

The `DoubtClearanceInlineView` component now includes a **StructuredMessageRenderer** that automatically parses and beautifully renders AI responses with rich formatting.

## Supported Formatting Types

### 1. Headers
Use `###` markdown or wrap text in `**bold**` for section headers:

```
### Understanding React Hooks
```
or
```
**Key Concepts**
```

**Renders as:** A blue-accented header with left border

---

### 2. Code Blocks
Wrap code in triple backticks with optional language specification:

````
```javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
```
````

**Renders as:** Syntax-highlighted code block with copy button

---

### 3. Bullet Lists
Start lines with `-`, `•`, or `*`:

```
- First point about the concept
- Second important detail
- Third key takeaway
```

**Renders as:** Blue-accented bullet points

---

### 4. Numbered Lists
Start lines with numbers followed by `.`:

```
1. Initialize the variable
2. Set up the loop
3. Return the result
```

**Renders as:** Blue-numbered list items

---

### 5. Info/Note Boxes
Start lines with specific emoji indicators:

```
ℹ️ This is informational content (blue box)
💡 This is a helpful tip (yellow box)
⚠️ This is a warning (orange box)
✅ This indicates success (green box)
❌ This indicates an error (red box)
```

**Renders as:** Color-coded callout boxes with icons

---

## Sample API Response Format

Here's a complete example of how your AI model should structure responses:

### Example 1: Explaining a Concept

```
### Understanding Recursion

Recursion is a programming technique where a function calls itself to solve a problem.

**Key Components**

1. Base case - The condition that stops recursion
2. Recursive case - The function calling itself
3. Progress toward base case - Each call must move closer to termination

Here's a simple example:

```javascript
function factorial(n) {
  // Base case
  if (n === 0 || n === 1) return 1;
  
  // Recursive case
  return n * factorial(n - 1);
}
```

💡 The base case prevents infinite recursion and stack overflow

### Common Use Cases

- Tree traversal
- Divide and conquer algorithms
- Mathematical sequences
- Backtracking problems

✅ Recursion makes complex problems easier to understand and solve
⚠️ Be careful with deep recursion as it can cause stack overflow
```

### Example 2: Problem Solution

```
### Solution Approach

Your question about finding duplicates can be solved efficiently using a hash map.

**Step-by-Step Process**

1. Create an empty hash map to track seen elements
2. Iterate through the array
3. Check if current element exists in the map
4. If yes, it's a duplicate
5. If no, add it to the map

Here's the implementation:

```python
def find_duplicates(arr):
    seen = {}
    duplicates = []
    
    for num in arr:
        if num in seen:
            duplicates.append(num)
        else:
            seen[num] = True
    
    return duplicates
```

**Time Complexity Analysis**

- Time: O(n) - single pass through array
- Space: O(n) - hash map storage

ℹ️ This approach trades space for time efficiency

### Alternative Approaches

- Sorting method: O(n log n) time, O(1) space
- Nested loops: O(n²) time, O(1) space
- Set operations: O(n) time, O(n) space

✅ Hash map approach is optimal for most use cases
```

## Backend Implementation

### Node.js/Express Example

```javascript
app.post('/chat-with-doubt-clearance', async (req, res) => {
  const { doubtId, message, userId } = req.body;
  
  // Call your AI model (e.g., Gemini, OpenAI, etc.)
  const aiResponse = await generateStructuredResponse(message);
  
  // Format the response with proper markdown structure
  const formattedResponse = `
### Understanding Your Question

${aiResponse.explanation}

**Key Points to Remember**

${aiResponse.keyPoints.map((point, i) => `${i + 1}. ${point}`).join('\n')}

${aiResponse.code ? '```' + aiResponse.language + '\n' + aiResponse.code + '\n```' : ''}

💡 ${aiResponse.tip}

### Next Steps

- ${aiResponse.nextSteps.join('\n- ')}

✅ You're making great progress!
  `.trim();
  
  res.json({ response: formattedResponse });
});
```

### Python/Flask Example

```python
@app.route('/chat-with-doubt-clearance', methods=['POST'])
def chat_with_doubt():
    data = request.json
    message = data['message']
    
    # Generate AI response
    ai_response = generate_ai_response(message)
    
    # Format with structure
    formatted_response = f"""
### {ai_response['title']}

{ai_response['explanation']}

**Key Concepts**

{"".join([f"{i+1}. {point}\n" for i, point in enumerate(ai_response['key_points'])])}

{'```' + ai_response.get('language', 'python') + '\n' + ai_response.get('code', '') + '\n```' if ai_response.get('code') else ''}

💡 {ai_response['tip']}

✅ {ai_response['encouragement']}
    """.strip()
    
    return jsonify({'response': formatted_response})
```

## Best Practices

1. **Always include headers** - Break content into logical sections
2. **Use appropriate emojis** - They add visual cues and improve scanning
3. **Format code properly** - Always specify the language for syntax highlighting
4. **Mix formatting types** - Combine lists, code, and callout boxes for clarity
5. **Keep paragraphs short** - Break up long text into digestible chunks
6. **End on a positive note** - Use ✅ to encourage the learner

## Testing Your Responses

You can test structured formatting by:

1. Opening the Doubts & Learning page
2. Selecting or creating a doubt
3. Sending a message in the chat
4. The AI response should render with all the rich formatting

## Visual Preview

When properly formatted, responses will display:
- 📘 Blue-accented headers with left borders
- 💻 Dark-themed code blocks with copy buttons
- 🎯 Color-coded bullet and numbered lists
- 🎨 Colorful callout boxes (blue, yellow, orange, green, red)
- 📝 Clean, professional typography

This creates a **much more engaging and professional learning experience** compared to plain text responses!
