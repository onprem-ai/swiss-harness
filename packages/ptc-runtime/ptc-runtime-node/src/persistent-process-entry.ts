/** Private built entry for the persistent Node REPL. */
import { openInheritedControlChannel } from '@onprem-ai/dsh-subprocess/control'
import { runPersistentMain } from './persistent-process.ts'

void runPersistentMain(openInheritedControlChannel(), Number(process.argv[2]), process)
