import { agentReporter } from '../reporters/agent-reporter.js';
import { blockReporter } from '../reporters/block-reporter.js';
import { markdownReporter } from '../reporters/markdown-reporter.js';
import { nyanReporter } from '../reporters/nyan-reporter.js';
import { tapReporter } from '../reporters/tap-reporter.js';
import { bindReporter } from './bind-reporter.js';
/** Dependencies first, data last: deps shape every reporter's output, the chosen name picks which one. */
export const selectReporter = (deps) => (options) => {
    if (options.reporter === 'nyan')
        return bindReporter(nyanReporter(deps));
    if (options.reporter === 'markdown')
        return bindReporter(markdownReporter(deps));
    if (options.reporter === 'block')
        return bindReporter(blockReporter(deps));
    if (options.reporter === 'agent')
        return bindReporter(agentReporter(deps));
    return bindReporter(tapReporter);
};
//# sourceMappingURL=select-reporter.js.map