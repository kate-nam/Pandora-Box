import fs from 'fs/promises'; // Using fs/promises for async file operations
import { exec } from 'child_process';
import { promisify } from 'util';

// Promisify exec to use async/await
const execAsync = promisify(exec);

export function parsePythonCode(text) {
    // Regular expression to capture everything between ```python and ```
    const codeMatch = text.match(/```python\s*([\s\S]*?)\s*```/);
    
    // If a match is found, return the code; otherwise, return null
    let code = codeMatch ? codeMatch[1].trim() : null;

    return code
  }


// Function to save and execute the Python code locally
export async function executePythonCode(pythonCode) {
  const filePath = './tempPython.py';

  await fs.writeFile(filePath, pythonCode, 'utf8');

  try {
    // Attempt to execute the Python script
    const { stdout, stderr } = await execAsync(`python3 ${filePath}`);
    console.log('Python code executed successfully\n', stdout);

  } catch (error) {
    // Check if the error is due to missing packages
    if (error.message.includes('ModuleNotFoundError')) {
      console.error('Module missing. Attempting to install dependencies...');

      // Extract the module name from the error message
      const missingModuleMatch = error.message.match(/No module named '(\w+)'/);
      if (missingModuleMatch) {
        const missingModule = missingModuleMatch[1];
        console.log(`Installing missing module: ${missingModule}`);

        // Install the missing module
        try {
          await execAsync(`python3 -m pip install ${missingModule}`);
          console.log(`Module ${missingModule} installed successfully. Re-running the Python script...`);

          // Re-run the Python script after installing the missing module
          const { stdout, stderr } = await execAsync(`python3 ${filePath}`);
          if (stderr) {
            console.error(`Python error output after re-running: ${stderr}`);
          } else {
            console.log('Python code executed successfully:\n', stdout);
          }
        } catch (installError) {
          console.error(`Failed to install module ${missingModule}: ${installError.message}`);
        }
      } else {
        console.error('Could not parse missing module name.');
      }
    } else {
      console.error(`Execution error: ${error.message}`);
    }
  }
}