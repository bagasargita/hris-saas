import { baseConfig } from '@saas/config/eslint';

export default [...baseConfig({ tsconfigRootDir: import.meta.dirname }), { ignores: ['dist/**'] }];
